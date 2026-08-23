import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

const BUCKET_NAME = "shop-images";
const BUCKET_PREFIX = "cdn/products/v4";
const PUBLIC_BASE_URL = "https://image.posselect.com";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 타임스탬프와 랜덤 문자열을 사용해 파일명 생성
    const timestamp = Date.now();
    const randomString = crypto.randomUUID().substring(0, 8);
    const extension = file.name.split('.').pop() || 'png';
    const filename = `${timestamp}-${randomString}.${extension}`;
    
    const key = `${BUCKET_PREFIX}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    const imageUrl = `${PUBLIC_BASE_URL}/${key}`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("[Upload API] Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
