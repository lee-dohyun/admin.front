export const PRODUCT_API_URL =
  process.env.PRODUCT_API_URL ?? "http://product-api.customer.svc.cluster.local:8080";
export const ORDER_API_URL =
  process.env.ORDER_API_URL ?? "http://order-api.customer.svc.cluster.local:8080";

// product-api/order-api가 이 토큰을 Keycloak staff realm JWKS로 직접 재검증하므로,
// 서비스 간에 별도로 공유/로테이션할 비밀값이 필요 없다.
export function adminHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
