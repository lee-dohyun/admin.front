import type { NextRequest } from "next/server";

export const PRODUCT_API_URL =
  process.env.PRODUCT_API_URL ?? "http://product-api.customer.svc.cluster.local:8080";
export const ORDER_API_URL =
  process.env.ORDER_API_URL ?? "http://order-api.customer.svc.cluster.local:8080";
// 회원 관리(admin.front#41). auth-api 는 고객 로그인도 담당하지만, 여기서 부르는
// /api/admin/** 은 staff realm 토큰을 요구하는 별도 경로다.
//
// ⚠️ 이 호출은 NetworkPolicy 를 탄다. `allow-auth-api` 에 `app: admin-front` 가 없으면
// 화면은 정상으로 보이면서 호출만 조용히 타임아웃된다 — 실제로 이 정책이 빠져 있었다.
export const AUTH_API_URL =
  process.env.AUTH_API_URL ?? "http://auth-api.customer.svc.cluster.local:8080";

// product-api/order-api가 이 토큰을 Keycloak staff realm JWKS로 직접 재검증하므로,
// 서비스 간에 별도로 공유/로테이션할 비밀값이 필요 없다.
export function adminHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * 관리자 토큰. middleware 가 matcher(`/api/admin/**`)에서 검증을 마친 뒤라 여기서는 꺼내기만 한다.
 *
 * GET 에도 실어 보내야 한다(product.api#74): product.api 는 토큰 없는 GET 을 공개 조회로 보고
 * LIVE 상품만 준다. 토큰을 빼먹으면 파트너가 만든 DRAFT·검수 중 상품이 관리자 목록에서 사라지고
 * 상세는 404 가 된다 — 에러 없이 "상품이 없다"로 보이는 게 함정이다.
 */
export function adminToken(request: NextRequest): string {
  return request.cookies.get("ADMIN_ACCESS_TOKEN")?.value ?? "";
}
