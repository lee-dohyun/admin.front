import { NextRequest } from "next/server";
import { AUTH_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

/**
 * 등급 정책 목록·생성 중계(gateway#80).
 *
 * 이 경로는 `lib/menu.ts` 의 「등급 관리」 apiPrefixes 에 등록돼 있어야 한다 — 빠지면 proxy 가 403 으로 막는다.
 * 역할은 auth.api `AdminAuthInterceptor` 가 같은 토큰으로 다시 검사한다.
 */
export async function GET(request: NextRequest) {
  const res = await fetch(`${AUTH_API_URL}/api/admin/member-grades`, {
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}

/** 생성. 같은 내용으로 다시 보내면 auth.api 가 새로 만들지 않고 기존 등급을 돌려준다(멱등). */
export async function POST(request: NextRequest) {
  const res = await fetch(`${AUTH_API_URL}/api/admin/member-grades`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
    cache: "no-store",
  });
  return relay(res);
}
