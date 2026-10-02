import { NextRequest } from "next/server";
import { AUTH_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

type Ctx = { params: Promise<{ keycloakUserId: string }> };

/**
 * 회원 등급 조회(현재 등급 + 이력)·수동 조정 중계(gateway#80).
 *
 * 회원은 Keycloak sub 로 가리킨다(이메일은 바뀔 수 있다 — 캐논 posselect #210).
 * 이 경로는 `lib/menu.ts` 「회원 관리」의 `/api/admin/members` 규칙을 그대로 탄다.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { keycloakUserId } = await params;
  const res = await fetch(`${AUTH_API_URL}/api/admin/members/${encodeURIComponent(keycloakUserId)}/grade`, {
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}

/**
 * 수동 조정. 이미 그 등급이면 auth.api 가 아무것도 바꾸지 않는다(멱등, `changed=false`).
 * 처리자는 auth.api 가 staff 토큰에서 읽어 로그에 남긴다 — 본문으로 받지 않는다.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { keycloakUserId } = await params;
  const res = await fetch(`${AUTH_API_URL}/api/admin/members/${encodeURIComponent(keycloakUserId)}/grade`, {
    method: "PUT",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
    cache: "no-store",
  });
  return relay(res);
}
