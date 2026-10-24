import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 주문 상세(gateway#329) — order.api 가 ORDER_MANAGER 토큰이면 소유자 검사 없이 준다.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${ORDER_API_URL}/api/orders/${encodeURIComponent(id)}`, {
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}
