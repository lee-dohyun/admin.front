import { NextRequest, NextResponse } from "next/server";
import { AUTH_API_URL, adminHeaders } from "@/lib/backend";

/**
 * 회원 목록 중계.
 *
 * `ADMIN_ACCESS_TOKEN` non-null 단언이 안전한 근거는 `middleware.ts` 의 사전 검사다
 * (이 라우트는 `/api/admin/**` 이라 matcher 안에 있다). 경로를 옮기면 그 전제가 사라진다.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const params = request.nextUrl.searchParams;

  const query = new URLSearchParams({
    page: params.get("page") ?? "0",
    size: params.get("size") ?? "20",
  });
  const search = params.get("search");
  if (search) {
    query.set("search", search);
  }

  const res = await fetch(`${AUTH_API_URL}/api/admin/members?${query}`, {
    headers: adminHeaders(token),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
