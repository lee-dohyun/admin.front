import { NextRequest, NextResponse } from "next/server";

const KEYCLOAK_REALM_URL =
  process.env.KEYCLOAK_REALM_URL ??
  "http://keycloak-service.keycloak.svc.cluster.local/realms/staff";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "admin-front";
const COOKIE_NAME = "ADMIN_ACCESS_TOKEN";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: "username/password required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: CLIENT_ID,
    username,
    password,
  });

  const tokenRes = await fetch(`${KEYCLOAK_REALM_URL}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const { access_token, expires_in } = await tokenRes.json();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: expires_in,
  });
  return response;
}
