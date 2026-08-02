import { jwtVerify, createRemoteJWKSet } from "jose";

// 네트워크 호출(JWKS 조회)은 클러스터 내부 DNS로 하지만, Keycloak이 실제로 토큰에 박아 넣는
// issuer는 (내부 URL로 요청해도) 항상 공개 URL이므로 검증 기준은 공개 URL을 써야 한다.
const KEYCLOAK_INTERNAL_URL =
  process.env.KEYCLOAK_REALM_URL ??
  "http://keycloak-service.keycloak.svc.cluster.local/realms/staff";
const EXPECTED_ISSUER =
  process.env.KEYCLOAK_EXPECTED_ISSUER ?? "https://keycloak.posselect.com/realms/staff";

const JWKS = createRemoteJWKSet(new URL(`${KEYCLOAK_INTERNAL_URL}/protocol/openid-connect/certs`));

export type AdminClaims = { email: string; name?: string };

export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: EXPECTED_ISSUER });
    if (!payload.email) return null;
    return { email: String(payload.email), name: payload.name ? String(payload.name) : undefined };
  } catch {
    return null;
  }
}
