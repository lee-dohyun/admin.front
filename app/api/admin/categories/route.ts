import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

export async function GET() {
  const res = await fetch(`${PRODUCT_API_URL}/api/categories`, { cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/categories`, {
    method: "POST",
    headers: adminHeaders(token),
    body,
  });
  const text = await res.text();
  // Content-Type 을 JSON 으로 못박지 않고 백엔드 것을 그대로 넘긴다. 생성 실패 사유
  // (예: 같은 상위 아래 이름 중복 409)는 평문으로 오는데, JSON 이라고 선언해 두면
  // 화면이 파싱에 실패해 사유가 "생성에 실패했습니다" 로 뭉뚱그려진다(product.api#61).
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "text/plain; charset=utf-8" },
  });
}
