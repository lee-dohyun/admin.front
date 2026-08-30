import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

/**
 * 카테고리 수정/삭제 중계 (product.api#61).
 *
 * 인가는 이 파일이 아니라 `middleware.ts` 가 건다 — `lib/menu.ts` 의 "카테고리 관리" 항목이
 * `/api/admin/categories` 를 apiPrefixes 로 갖고 있고, `matchesPrefix` 가 세그먼트 경계까지
 * 보므로 하위 경로인 이 라우트도 같은 규칙(PRODUCT_MANAGER / SYSTEM_ADMIN)에 매칭된다.
 * menu.ts 에 따로 추가할 것은 없다.
 *
 * 응답 본문을 버리지 않고 그대로 넘기는 이유: 백엔드가 삭제 거부(409) 시 "하위 카테고리 3개,
 * 상품 5개가 연결되어 있어..." 처럼 사유를 본문에 담아 준다. 상품 쪽 DELETE 라우트처럼
 * `new NextResponse(null, ...)` 로 만들면 그 사유가 화면에 도달하지 못하고 실패가
 * 뭉뚱그려진다. 백엔드 에러 본문은 JSON 이 아니라 평문이므로 Content-Type 도 함께 넘긴다.
 */
function passThrough(status: number, body: string, contentType: string | null): NextResponse {
  if (!body) {
    return new NextResponse(null, { status });
  }
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": contentType ?? "text/plain; charset=utf-8" },
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/categories/${id}`, {
    method: "PUT",
    headers: adminHeaders(token),
    body,
  });
  return passThrough(res.status, await res.text(), res.headers.get("Content-Type"));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const res = await fetch(`${PRODUCT_API_URL}/api/categories/${id}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
  return passThrough(res.status, await res.text(), res.headers.get("Content-Type"));
}
