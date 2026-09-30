// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GET } from "./route";

// gateway#283 — 이 앱은 게이트웨이/Traefik 뒤에서 `next start` 로 돈다. 서버가 보는 요청 URL 은
// 사용자가 접속한 주소(admin.posselect.com)가 아니라 컨테이너 호스트(localhost:3000)라서,
// `new URL("/login", request.url)` 로 만든 절대 주소로 리다이렉트하면 사용자가 열리지 않는
// `https://localhost:3000/login` 으로 간다. Location 은 요청 URL 과 무관한 상대 경로여야 한다.
describe("GET /api/logout", () => {
  it("/login 으로 상대 경로 리다이렉트한다", async () => {
    const res = await GET();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("로그인 쿠키를 지운다", async () => {
    const res = await GET();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/ADMIN_ACCESS_TOKEN=;/);
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
