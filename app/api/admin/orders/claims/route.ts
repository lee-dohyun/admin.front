import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 고객 취소·반품 신청 목록(gateway#320). 권한은 proxy 가 「주문 관리」 규칙(/api/admin/orders)으로 본다.
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? "REQUESTED";
  const res = await fetch(`${ORDER_API_URL}/api/orders/claims?status=${encodeURIComponent(status)}`, {
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}
