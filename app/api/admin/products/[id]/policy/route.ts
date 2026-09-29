import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";

/**
 * 판매 정책(admin.front#53) 중계. 인가는 middleware(`/api/admin/products` → PRODUCT_MANAGER)와
 * product.api AdminAuthInterceptor 가 각각 본다. 400(모순 입력) 사유는 본문 그대로 넘긴다.
 */
type Ctx = { params: Promise<{ id: string }> };

async function relay(res: Response): Promise<NextResponse> {
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}/policy`, {
    cache: "no-store",
    headers: adminHeaders(adminToken(request)),
  });
  return relay(res);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}/policy`, {
    method: "PUT",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
  });
  return relay(res);
}
