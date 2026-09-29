import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MAX_UPLOAD_BYTES, UPLOAD_BUCKET, checkUpload, objectKey, publicUrl } from "@/lib/upload";

// MinIO S3 client setup
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://minio.minio.svc.cluster.local:9000",
  region: "minio",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

/**
 * 관리자 상품 이미지 업로드(admin.front#48). 인증·역할은 middleware(`/api/admin/upload` → PRODUCT_MANAGER).
 * 형식은 파일 바이트로 판정하고(JPG/PNG/WEBP), 5MB 를 넘으면 거부한다 — 규칙은 lib/upload.ts.
 */
export async function POST(request: NextRequest) {
  // formData() 가 본문을 전부 메모리에 올리기 전에 선언된 길이로 먼저 거른다(multipart 오버헤드 여유 64KB).
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "이미지는 5MB 이하만 올릴 수 있습니다." }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "잘못된 업로드 요청입니다." }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes.byteLength, bytes.subarray(0, 16));
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const key = objectKey(check.kind.ext, crypto.randomUUID());
  try {
    await s3Client.send(
      new PutObjectCommand({ Bucket: UPLOAD_BUCKET, Key: key, Body: bytes, ContentType: check.kind.contentType }),
    );
  } catch (error) {
    console.error("[Upload API] MinIO 저장 실패:", error);
    return NextResponse.json({ error: "이미지 저장에 실패했습니다." }, { status: 502 });
  }
  return NextResponse.json({ imageUrl: publicUrl(key) });
}
