import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, checkUpload, objectKey, publicUrl, sniffImage } from "./upload";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webp = new Uint8Array([...Array.from("RIFF", (c) => c.charCodeAt(0)), 0, 0, 0, 0, ...Array.from("WEBP", (c) => c.charCodeAt(0))]);
const html = new Uint8Array(Array.from("<html><body>", (c) => c.charCodeAt(0)));

describe("sniffImage", () => {
  it("시그니처로 형식을 판정한다", () => {
    expect(sniffImage(png)?.ext).toBe("png");
    expect(sniffImage(jpg)?.ext).toBe("jpg");
    expect(sniffImage(webp)?.ext).toBe("webp");
  });
  it("이미지가 아니면 null — 확장자를 .png 로 바꾼 HTML 도 걸린다", () => {
    expect(sniffImage(html)).toBeNull();
  });
});

describe("checkUpload", () => {
  it("빈 파일 400, 5MB 초과 413, 비이미지 415", () => {
    expect(checkUpload(0, png)).toMatchObject({ ok: false, status: 400 });
    expect(checkUpload(MAX_UPLOAD_BYTES + 1, png)).toMatchObject({ ok: false, status: 413 });
    expect(checkUpload(100, html)).toMatchObject({ ok: false, status: 415 });
  });
  it("정상 이미지는 판정 결과를 돌려준다", () => {
    expect(checkUpload(100, png)).toEqual({ ok: true, kind: { ext: "png", contentType: "image/png" } });
  });
});

describe("objectKey / publicUrl", () => {
  it("공개 URL 은 cdn 버킷 키와 같은 경로다 (shop-images 버킷을 쓰면 404 였다)", () => {
    const key = objectKey("png", "abc");
    expect(key).toBe("products/admin/abc.png");
    expect(publicUrl(key)).toBe("https://image.posselect.com/cdn/products/admin/abc.png");
  });
});
