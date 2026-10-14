import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 교환 운송장 등록 → 교환 완료(gateway#320). 권한은 proxy 가 「주문 관리」 규칙으로 본다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const res = await fetch(`${ORDER_API_URL}/api/orders/claims/${encodeURIComponent(claimId)}/exchange-shipment`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return relay(res);
}
