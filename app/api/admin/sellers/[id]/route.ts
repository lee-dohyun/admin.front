import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { parseSellerId } from "@/lib/sellers";

type Ctx = { params: Promise<{ id: string }> };

/** 판매자 상세(기본 정보·판매 설정·서류·상태 이력). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const id = parseSellerId((await params).id);
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const res = await fetch(`${PRODUCT_API_URL}/api/sellers/${id}`, {
    cache: "no-store",
    headers: adminHeaders(adminToken(request)),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}

/** 기본 정보 + 판매 설정(정산 계좌·출고지·반품지·배송비 정책·CS) 전체 교체. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const id = parseSellerId((await params).id);
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const res = await fetch(`${PRODUCT_API_URL}/api/sellers/${id}`, {
    method: "PUT",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
