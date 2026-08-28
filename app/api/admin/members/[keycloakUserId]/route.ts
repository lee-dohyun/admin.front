import { NextRequest, NextResponse } from "next/server";
import { AUTH_API_URL, adminHeaders } from "@/lib/backend";

/**
 * 회원 파기 중계 — 되돌릴 수 없다.
 *
 * 소유자 키는 Keycloak sub 다. 이메일은 변경 가능해 키로 쓰지 않는다(캐논 posselect #210).
 * 실제 파기 범위와 순서는 auth.api 의 `AdminMemberController` 가 정한다.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keycloakUserId: string }> }
) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const { keycloakUserId } = await params;

  const res = await fetch(
    `${AUTH_API_URL}/api/admin/members/${encodeURIComponent(keycloakUserId)}`,
    {
      method: "DELETE",
      headers: adminHeaders(token),
      cache: "no-store",
    }
  );

  // 백엔드가 404(대상 없음)일 때는 본문이 비어 있다 — 그대로 json() 하면 파싱 에러가 난다.
  if (res.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(await res.json(), { status: res.status });
}
