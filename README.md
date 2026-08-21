# admin.front

posselect.com 쇼핑몰의 **직원용 백오피스(관리자)**. Next.js 15(App Router) + React 19 + Tailwind 4.
프로덕션에서는 `admin.posselect.com`으로 서비스된다.

> 이 README는 2026-08-21 이전까지 `product.front`의 설명이 그대로 복사돼 있었다. 아래 내용이 실제 구조다.

## 구조

```
app/admin/products/            상품 목록 / 신규 / 수정 (+ ProductForm, VariantManager)
app/admin/categories/          카테고리 관리
app/admin/orders/              주문 관리 (배송 등록/완료 처리)
app/api/admin/**               product-api / order-api로 중계하는 자체 API 라우트
app/api/login, app/api/logout  Keycloak staff realm 로그인 / 쿠키 삭제
app/login/                     로그인 화면
app/page.tsx                   / → /admin/products 리다이렉트
middleware.ts                  인증 + RBAC 게이트 (이 앱의 보안 경계)
lib/auth.ts                    ADMIN_ACCESS_TOKEN 검증 (staff realm JWKS, jose)
lib/menu.ts                    메뉴 트리 = RBAC/ABAC 규칙 정의
lib/backend.ts                 product-api / order-api 클러스터 내부 주소 + Bearer 헤더
components/auth/RequirePermission.tsx   서버 컴포넌트용 권한 게이트
```

## 인증/인가

고객용 프론트와 완전히 다른 경로를 쓴다.

- 로그인: `app/api/login`이 Keycloak **staff** realm에 password grant로 직접 토큰을 받아
  `ADMIN_ACCESS_TOKEN` 쿠키(httpOnly, secure)로 심는다. 고객용 `ACCESS_TOKEN`(customer realm)과 무관하다.
- 검증: `middleware.ts`가 `matcher: ["/admin/:path*", "/api/admin/:path*"]`에 대해 `lib/auth.ts`로
  JWT를 검증하고, `lib/menu.ts`의 `adminMenus`에 등록된 경로면 `requiredRoles`/`requiredAttributes`로
  RBAC/ABAC 검사를 한다. 실패 시 페이지는 403, `/api/`는 JSON 403, 비로그인은 `/login`으로 리다이렉트.
- 백엔드 호출: `lib/backend.ts`가 staff 토큰을 `Authorization: Bearer`로 그대로 전달하고,
  product-api/order-api가 같은 JWKS로 **재검증**한다 — 서비스 간 공유 비밀값이 없다.

**게이트웨이 주입 헤더(`X-User-*`)는 이 저장소에서 전혀 읽지 않는다.** `admin.posselect.com`은
게이트웨이의 `protected-hosts`/`optional-auth-hosts` 어디에도 없어서 게이트웨이가 그 헤더를 제거만 하고
주입하지 않기 때문이다. 즉 인증은 100% 이 저장소 책임이다. 알려진 격차(메뉴 미등록 경로·`/api/admin/**`의
RBAC 미적용)는 `AGENTS.md`에 정리돼 있다.

## 게이트웨이 경유 구조

```
브라우저 → Traefik(Ingress) → spring-cloud-gateway → admin-front.customer.svc.cluster.local:3000
```

이 호스트만 라우트가 3개로 갈라져 있다(다른 프론트와 다른 점):

1. `admin-front-api` — `Path=/api/**`를 먼저 통과시킨다(로그인/관리 API가 동작해야 하므로).
2. `admin-front-block-write` — 그 외 경로의 POST/PUT/PATCH/DELETE를 403으로 차단(msa #155 대응).
   → **Server Action은 프로덕션에서 403**이므로 쓰기는 `app/api/admin/**` route handler로만 한다.
3. `admin-front` — 나머지 catch-all.

## 로컬 개발

```bash
npm install
npm run dev        # http://localhost:3000

npm run typecheck  # tsc --noEmit — push 전 필수
npm run lint
```

기본값이 클러스터 내부 DNS이므로 로컬에서는 다음 환경변수가 필요하다.

| 변수 | 기본값 |
| --- | --- |
| `KEYCLOAK_REALM_URL` | `http://keycloak-service.keycloak.svc.cluster.local/realms/staff` |
| `KEYCLOAK_EXPECTED_ISSUER` | `https://keycloak.posselect.com/realms/staff` |
| `KEYCLOAK_CLIENT_ID` | `admin-front` |
| `PRODUCT_API_URL` | `http://product-api.customer.svc.cluster.local:8080` |
| `ORDER_API_URL` | `http://order-api.customer.svc.cluster.local:8080` |

로컬에서는 게이트웨이를 거치지 않으므로 쓰기 차단 등 게이트웨이 동작은 재현되지 않는다.

## 배포 (K3s, CD 자동)

`.github/workflows/docker-image.yml`

1. main push / PR → Docker 이미지 빌드 후 `leedohyun1985/admin.front:{latest,<sha>}`로 push
2. Trivy 취약점 스캔 (`exit-code: "0"` — **리포트 전용, 빌드를 막지 않는다**)
3. main push일 때만 self-hosted 러너(`k3s-home`)에서
   `kubectl set image deployment/admin-front -n customer` → rollout 대기

**main에 push하면 곧바로 프로덕션에 반영된다.** CI는 lint/typecheck를 돌리지 않으므로 검증은 로컬 책임이다.
문서/설정만 바꾼 커밋에는 메시지 끝에 `[skip ci]`를 붙일 것.
이 저장소는 `package-lock.json`이 없어 빌드가 재현되지 않는다는 점도 알고 있을 것(`AGENTS.md` 참고).

## 관련 저장소

`gateway`(단일 진입점) · `product.api`(상품/카테고리) · `order.api`(주문/배송) · `posselect-ui` ·
매니페스트는 `~/msa`.
