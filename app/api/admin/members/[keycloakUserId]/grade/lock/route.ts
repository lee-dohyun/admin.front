import { NextRequest } from "next/server";
import { AUTH_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

type Ctx = { params: Promise<{ keycloakUserId: string }> };

/**
 * 회원 등급 고정 해제 중계(auth.api#49).
 *
 * 등급은 그대로 두고 고정만 푼다 — 다음 정기 재산정(매월 1일)부터 다시 계산된다. 이미 고정이 아니면
 * auth.api 가 아무것도 바꾸지 않는다(멱등, `changed=false`).
 * 이 경로도 `lib/menu.ts` 「회원 관리」의 `/api/admin/members` 규칙을 탄다.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { keycloakUserId } = await params;
  const res = await fetch(`${AUTH_API_URL}/api/admin/members/${encodeURIComponent(keycloakUserId)}/grade/lock`, {
    method: "DELETE",
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}
