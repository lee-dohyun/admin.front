export const PRODUCT_API_URL =
  process.env.PRODUCT_API_URL ?? "http://product-api.customer.svc.cluster.local:8080";
export const ORDER_API_URL =
  process.env.ORDER_API_URL ?? "http://order-api.customer.svc.cluster.local:8080";
export const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET ?? "";

export function adminHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Admin-Secret": ADMIN_SHARED_SECRET,
  };
}
