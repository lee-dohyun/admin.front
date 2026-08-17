import { jwtVerify, createRemoteJWKSet } from "jose";

// 네트워크 호출(JWKS 조회)은 클러스터 내부 DNS로 하지만, Keycloak이 실제로 토큰에 박아 넣는
// issuer는 (내부 URL로 요청해도) 항상 공개 URL이므로 검증 기준은 공개 URL을 써야 한다.
const KEYCLOAK_INTERNAL_URL =
  process.env.KEYCLOAK_REALM_URL ??
  "http://keycloak-service.keycloak.svc.cluster.local/realms/staff";
const EXPECTED_ISSUER =
  process.env.KEYCLOAK_EXPECTED_ISSUER ?? "https://keycloak.posselect.com/realms/staff";

const JWKS = createRemoteJWKSet(new URL(`${KEYCLOAK_INTERNAL_URL}/protocol/openid-connect/certs`));

export type AdminClaims = { 
  email: string; 
  name?: string; 
  roles: string[];
  attributes?: Record<string, string | string[]>;
};

export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: EXPECTED_ISSUER });
    if (!payload.email) return null;
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    const roles = realmAccess?.roles || [];
    
    // Keycloak 토큰 페이로드에서 표준 클레임 외의 커스텀 속성(Attributes) 추출
    const standardClaims = new Set([
      'exp', 'iat', 'auth_time', 'jti', 'iss', 'aud', 'sub', 'typ', 'azp', 'nonce',
      'session_state', 'acr', 'allowed-origins', 'realm_access', 'resource_access', 
      'scope', 'sid', 'email_verified', 'name', 'preferred_username', 'given_name', 'family_name', 'email'
    ]);
    
    const attributes: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!standardClaims.has(key)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          attributes[key] = String(value);
        } else if (Array.isArray(value)) {
          attributes[key] = value.map(String);
        }
      }
    }

    return { 
      email: String(payload.email), 
      name: payload.name ? String(payload.name) : undefined, 
      roles,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined
    };
  } catch {
    return null;
  }
}
