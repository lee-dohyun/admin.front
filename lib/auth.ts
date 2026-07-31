import { jwtVerify, createRemoteJWKSet } from "jose";

const KEYCLOAK_REALM_URL =
  process.env.KEYCLOAK_REALM_URL ??
  "http://keycloak-service.keycloak.svc.cluster.local/realms/staff";

const JWKS = createRemoteJWKSet(new URL(`${KEYCLOAK_REALM_URL}/protocol/openid-connect/certs`));

export type AdminClaims = { email: string; name?: string };

export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: KEYCLOAK_REALM_URL });
    if (!payload.email) return null;
    return { email: String(payload.email), name: payload.name ? String(payload.name) : undefined };
  } catch {
    return null;
  }
}
