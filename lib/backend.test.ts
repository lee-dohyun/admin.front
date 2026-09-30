import { describe, expect, it } from "vitest";
import { relay } from "./backend";

describe("relay — 백엔드 응답을 파싱하지 않고 그대로 중계한다 (admin.front#62)", () => {
  it("JSON 본문은 상태·Content-Type 을 유지한다", async () => {
    const out = await relay(new Response('{"a":1}', { status: 200, headers: { "Content-Type": "application/json" } }));
    expect(out.status).toBe(200);
    expect(out.headers.get("Content-Type")).toContain("application/json");
    expect(await out.json()).toEqual({ a: 1 });
  });

  it("텍스트 404 본문(product.api 의 'product not found')이 500 으로 바뀌지 않는다", async () => {
    const out = await relay(
      new Response("product not found id=999999999", { status: 404, headers: { "Content-Type": "text/plain;charset=UTF-8" } })
    );
    expect(out.status).toBe(404);
    expect(out.headers.get("Content-Type")).toContain("text/plain");
    expect(await out.text()).toBe("product not found id=999999999");
  });

  it("Content-Type 이 없으면 text/plain 으로 둔다(JSON 이라고 지어내지 않는다)", async () => {
    const out = await relay(new Response("boom", { status: 502 }));
    expect(out.status).toBe(502);
    expect(out.headers.get("Content-Type")).toContain("text/plain");
  });

  it("본문 없는 상태(204)에서 던지지 않는다", async () => {
    const out = await relay(new Response(null, { status: 204 }));
    expect(out.status).toBe(204);
  });
});
