import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { parseSellerId } from "@/lib/sellers";
import { validateTransition } from "@/lib/sellers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 입점 상태 전이(심사 요청·시작·승인·반려·정지·해지). 반려·정지·해지는 사유 코드 필수.
 * 처리자(changedBy)는 product.api 가 staff 토큰에서 채운다 — 본문으로 받지 않는다.
 * 현재 상태를 서버에서 다시 읽어 검사한다: 화면이 오래된 상태로 버튼을 눌러도 여기서 걸러진다(서버도 409).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const id = parseSellerId((await params).id);
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const token = adminToken(request);
  const body = (await request.json().catch(() => null)) as { toStatus?: string; reasonCode?: string; reasonNote?: string } | null;
  if (!body?.toStatus) return NextResponse.json({ error: "toStatus required" }, { status: 400 });

  const current = await fetch(`${PRODUCT_API_URL}/api/sellers/${id}`, { cache: "no-store", headers: adminHeaders(token) });
  if (!current.ok) return new NextResponse(await current.text(), { status: current.status });
  const from: string = (await current.json()).seller.status;
  const problem = validateTransition(from, body.toStatus, body.reasonCode);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  const res = await fetch(`${PRODUCT_API_URL}/api/sellers/${id}/transition`, {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify({ toStatus: body.toStatus, reasonCode: body.reasonCode ?? null, reasonNote: body.reasonNote?.trim() || null }),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
