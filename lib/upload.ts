/**
 * 관리자 이미지 업로드 검증 — 순수 함수(단위 테스트 대상). admin.front#48.
 * partner.front/lib/upload.ts 와 같은 규칙이다(두 앱이 같은 버킷·같은 공개 URL 체계를 쓴다).
 *
 * Content-Type 과 확장자는 클라이언트가 마음대로 정한다. 그래서 **파일 앞부분 바이트(시그니처)**로
 * 실제 형식을 판정하고, 저장 키의 확장자·ContentType 도 그 판정 결과로 정한다. 사용자가 준 파일명은
 * 키에 쓰지 않는다(경로 조작·이상한 확장자 차단).
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ImageKind = { ext: "jpg" | "png" | "webp"; contentType: string };

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export type UploadCheck =
  | { ok: true; kind: ImageKind }
  | { ok: false; status: 400 | 413 | 415; message: string };

export function checkUpload(size: number, head: Uint8Array): UploadCheck {
  if (size <= 0) return { ok: false, status: 400, message: "빈 파일입니다." };
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, message: "이미지는 5MB 이하만 올릴 수 있습니다." };
  }
  const kind = sniffImage(head);
  if (!kind) {
    return { ok: false, status: 415, message: "JPG, PNG, WEBP 이미지만 올릴 수 있습니다." };
  }
  return { ok: true, kind };
}

/**
 * 버킷이 `cdn` 인 이유: 공개 URL `image.posselect.com/cdn/<key>` 는 cdn-alias → imgproxy 가
 * **`cdn` 버킷**의 `<key>` 를 읽는다(IMGPROXY_BASE_URL=s3://cdn/). 예전 코드는 `shop-images` 버킷에
 * `cdn/products/v4/...` 키로 써서 업로드는 성공하고 돌려준 URL 은 404 였다(partner.front 에서 실측,
 * 같은 구조라 admin 도 동일 — `shop-images/cdn/products/v4/` 객체 0건, 운영에서 쓰인 적 없음).
 */
export const UPLOAD_BUCKET = "cdn";

export function objectKey(ext: string, id: string): string {
  return `products/admin/${id}.${ext}`;
}

export function publicUrl(key: string): string {
  return `https://image.posselect.com/cdn/${key}`;
}
