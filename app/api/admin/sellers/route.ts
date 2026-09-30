import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { parseSellerStatusFilter } from "@/lib/sellers";

/**
 * 판매자 목록·신규 등록(admin.front#23). 인가: proxy(`/api/admin/sellers` → PARTNER|SYSTEM_ADMIN)와
 * product.api AdminAuthInterceptor(/api/sellers → PARTNER, GET 포함 — product.api#74)가 각각 본다.
 */
export async function GET(request: NextRequest) {
  const status = parseSellerStatusFilter(request.nextUrl.searchParams.get("status"));
  if (status === "invalid") return NextResponse.json({ error: "invalid status" }, { status: 400 });
  const query = status ? `?status=${status}` : "";
  const res = await fetch(`${PRODUCT_API_URL}/api/sellers${query}`, {
    cache: "no-store",
    headers: adminHeaders(adminToken(request)),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}

/** 신규 판매자는 항상 작성 중(DRAFT)·공급사(SUPPLIER)로 만들어진다(product.api SellerService.createSeller). */
export async function POST(request: NextRequest) {
  const res = await fetch(`${PRODUCT_API_URL}/api/sellers`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
