import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, relay, adminToken } from "@/lib/backend";
import { parseProductStatusFilter } from "@/lib/products";

/**
 * 관리자 상품 목록 — 상태·판매자 포함(admin.front#50). 공개 목록(`/api/products`)이 아니라 직원 전용
 * `/api/products/manage` 를 부른다(product.api 가 PRODUCT_MANAGER 토큰이 아니면 404).
 */
export async function GET(request: NextRequest) {
  const status = parseProductStatusFilter(request.nextUrl.searchParams.get("status"));
  if (status === "invalid") {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const query = status ? `?status=${status}` : "";
  const res = await fetch(`${PRODUCT_API_URL}/api/products/manage${query}`, {
    cache: "no-store",
    headers: adminHeaders(adminToken(request)),
  });
  return relay(res);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/products`, {
    method: "POST",
    headers: adminHeaders(token),
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
