import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { PartnerAccountError, findPartnerAccount, issuePartnerAccount, resetPartnerPassword } from "@/lib/partner-accounts";
import { parseSellerId } from "@/lib/sellers";

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  if (e instanceof PartnerAccountError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[partner-account] 처리 실패", e);
  return NextResponse.json({ error: "파트너 계정 처리에 실패했습니다." }, { status: 500 });
}

/** 이 판매자에게 발급된 파트너 계정(없으면 account=null). */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const sellerId = parseSellerId((await params).id);
  if (!sellerId) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    return NextResponse.json({ account: await findPartnerAccount(sellerId) });
  } catch (e) {
    return fail(e);
  }
}

/**
 * 파트너 계정 발급(admin.front#23). **운영 중(ACTIVE) 판매자만** — 심사를 안 거친 판매자가 파트너 API 에
 * 쓰기를 할 수는 없지만(product.api 가 ACTIVE 가 아니면 쓰기 403), 로그인 자체도 승인 뒤에 열어 준다.
 * 판매자 정보는 product.api 에서 다시 읽는다(본문의 이메일을 믿지 않는다). 초기 비밀번호는 응답에서 한 번만.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const sellerId = parseSellerId((await params).id);
  if (!sellerId) return NextResponse.json({ error: "not found" }, { status: 404 });
  const token = adminToken(request);
  const res = await fetch(`${PRODUCT_API_URL}/api/sellers/${sellerId}`, { cache: "no-store", headers: adminHeaders(token) });
  if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
  const seller = (await res.json()).seller as { id: number; name: string; email: string; status: string };
  if (seller.status !== "ACTIVE") {
    return NextResponse.json({ error: "운영 중(승인된) 판매자에게만 계정을 발급할 수 있습니다." }, { status: 409 });
  }
  try {
    const result = await issuePartnerAccount(seller.id, seller.email, seller.name);
    const admin = await verifyAdminToken(token);
    console.info(`[partner-account] 발급 sellerId=${seller.id} username=${result.account.username} by=${admin?.email ?? "?"}`);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/**
 * 비밀번호 재발급 — 판매자가 비밀번호를 잃었거나, 발급 직후 화면을 닫아 초기 비밀번호를 놓쳤을 때.
 * 새 비밀번호도 응답에서 한 번만 보여 준다. 계정은 seller_id 로 찾는다(본문 입력 없음).
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const sellerId = parseSellerId((await params).id);
  if (!sellerId) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const result = await resetPartnerPassword(sellerId);
    const admin = await verifyAdminToken(adminToken(request));
    console.info(`[partner-account] 비밀번호 재발급 sellerId=${sellerId} username=${result.account.username} by=${admin?.email ?? "?"}`);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
