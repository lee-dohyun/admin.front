import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 주문 전체 환불(gateway#329) — 남은 결제 금액 환불 + 재고 복원 + 환불 안내 메일은 order.api 가 한다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${ORDER_API_URL}/api/orders/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return relay(res);
}
