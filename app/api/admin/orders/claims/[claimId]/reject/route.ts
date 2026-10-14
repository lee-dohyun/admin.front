import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 고객 반품 신청 반려 — order.api 가 잡아 둔 수량을 돌려놓는다(gateway#320).
export async function POST(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const res = await fetch(`${ORDER_API_URL}/api/orders/claims/${encodeURIComponent(claimId)}/reject`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return relay(res);
}
