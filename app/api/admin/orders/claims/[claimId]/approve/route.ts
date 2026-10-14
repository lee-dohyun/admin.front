import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 고객 반품 신청 승인 — order.api 가 환불과 재고 복원까지 끝낸다(gateway#320).
export async function POST(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const res = await fetch(`${ORDER_API_URL}/api/orders/claims/${encodeURIComponent(claimId)}/approve`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return relay(res);
}
