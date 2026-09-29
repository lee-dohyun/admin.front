import { randomBytes } from "node:crypto";
import { generateInitialPassword } from "@/lib/sellers";

/**
 * 파트너(외부 판매자) 로그인 계정 발급(admin.front#23) — Keycloak partner realm Admin REST.
 *
 * **서버 전용** — route handler 에서만 import 할 것(서비스 계정 비밀이 담긴 환경변수를 읽는다).
 * 서비스 계정 클라이언트 partner-provisioner(realm-management manage/view/query-users 만)의 토큰으로
 * 호출한다. 자격증명은 Secret customer/admin-front-partner-provisioner → 환경변수. 이 파일은 서버 전용이다.
 *
 * 계정의 `seller_id` 속성이 파트너 API(product.api /api/partner/**)의 데이터 범위 경계다.
 * 파트너 본인은 이 속성을 못 고친다 — partner realm 기본 역할에서 manage-account 를 뺐다(gateway#278, 403 실측).
 */
export type PartnerAccount = { id: string; username: string; email: string | null; enabled: boolean };

/** 환경변수는 호출 시점에 읽는다(모듈 로드 시점 고정은 빌드·테스트 환경에서 깨지기 쉽다). */
function config() {
  return {
    realmUrl: process.env.PARTNER_REALM_URL ?? "",
    adminUrl: process.env.PARTNER_ADMIN_URL ?? "",
    clientId: process.env.PARTNER_PROVISIONER_CLIENT_ID ?? "",
    clientSecret: process.env.PARTNER_PROVISIONER_CLIENT_SECRET ?? "",
  };
}

export class PartnerAccountError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function serviceToken(): Promise<string> {
  const { realmUrl, adminUrl, clientId, clientSecret } = config();
  if (!realmUrl || !adminUrl || !clientId || !clientSecret) {
    throw new PartnerAccountError(503, "파트너 계정 발급 설정이 없습니다(PARTNER_* 환경변수).");
  }
  const res = await fetch(`${config().realmUrl}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    cache: "no-store",
  });
  if (!res.ok) throw new PartnerAccountError(502, `Keycloak 서비스 토큰 발급 실패(${res.status})`);
  return (await res.json()).access_token as string;
}

/** 이 판매자에게 이미 발급된 계정(seller_id 속성 일치). 없으면 null. */
export async function findPartnerAccount(sellerId: number): Promise<PartnerAccount | null> {
  const token = await serviceToken();
  const res = await fetch(`${config().adminUrl}/users?q=seller_id:${sellerId}&exact=true&max=1000`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new PartnerAccountError(502, `Keycloak 사용자 조회 실패(${res.status})`);
  const users: { id: string; username: string; email?: string; enabled: boolean; attributes?: Record<string, string[]> }[] =
    await res.json();
  // q 검색은 부분 일치일 수 있다(seller_id:1 이 11 도 잡을 수 있음) — 값이 정확히 같은 것만 인정한다.
  // max 를 주지 않으면 Keycloak 이 100 건에서 자르므로 정확 일치가 잘려 나갈 수 있다.
  const match = users.find((u) => u.attributes?.seller_id?.includes(String(sellerId)));
  return match ? { id: match.id, username: match.username, email: match.email ?? null, enabled: match.enabled } : null;
}

/**
 * 계정 발급. 이미 있으면 409. 초기 비밀번호는 **이 응답에서 한 번만** 돌려준다 — 저장하지 않는다.
 * temporary=false 인 이유: partner.front 로그인은 ROPC 라 Keycloak "비밀번호 변경 필요" 같은 required
 * action 이 걸린 계정은 로그인 자체가 막힌다(비밀번호 변경 화면은 후속 과제).
 */
export async function issuePartnerAccount(
  sellerId: number,
  email: string,
  sellerName: string,
): Promise<{ account: PartnerAccount; initialPassword: string }> {
  if (await findPartnerAccount(sellerId)) {
    throw new PartnerAccountError(409, "이 판매자에게는 이미 파트너 계정이 발급되어 있습니다.");
  }
  const token = await serviceToken();
  const username = email.trim().toLowerCase();
  const initialPassword = generateInitialPassword((n) => randomBytes(n));
  const res = await fetch(`${config().adminUrl}/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: username,
      emailVerified: true,
      enabled: true,
      firstName: sellerName,
      attributes: { seller_id: [String(sellerId)] },
      credentials: [{ type: "password", value: initialPassword, temporary: false }],
    }),
    cache: "no-store",
  });
  if (res.status === 409) {
    throw new PartnerAccountError(409, `같은 아이디(${username})의 파트너 계정이 이미 있습니다. 판매자 이메일을 확인해 주세요.`);
  }
  if (!res.ok) {
    console.error(`[partner-account] Keycloak 계정 생성 실패 ${res.status}`, (await res.text()).slice(0, 500));
    throw new PartnerAccountError(502, `Keycloak 계정 생성에 실패했습니다(${res.status}).`);
  }
  // 생성 응답의 Location(…/users/{id})으로 계정을 만든다. 재조회에 의존하면 조회가 실패했을 때 이미 만들어진
  // 계정의 초기 비밀번호를 영영 잃는다(재시도는 409) — 리뷰 지적.
  const id = res.headers.get("Location")?.split("/").pop() ?? "";
  return { account: { id, username, email: username, enabled: true }, initialPassword };
}

/** 비밀번호 재발급. 계정이 없으면 404. 새 비밀번호는 응답에서 한 번만. */
export async function resetPartnerPassword(sellerId: number): Promise<{ account: PartnerAccount; initialPassword: string }> {
  const account = await findPartnerAccount(sellerId);
  if (!account) throw new PartnerAccountError(404, "이 판매자에게 발급된 파트너 계정이 없습니다.");
  const token = await serviceToken();
  const initialPassword = generateInitialPassword((n) => randomBytes(n));
  const res = await fetch(`${config().adminUrl}/users/${account.id}/reset-password`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "password", value: initialPassword, temporary: false }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[partner-account] 비밀번호 재설정 실패 ${res.status}`, (await res.text()).slice(0, 500));
    throw new PartnerAccountError(502, `비밀번호 재설정에 실패했습니다(${res.status}).`);
  }
  return { account, initialPassword };
}
