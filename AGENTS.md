# admin.front AI 개발 지침

> **캐논 참조**: 공통 개발 원칙(DB/트랜잭션/보안/배포 규칙 등)은 `~/msa/AGENTS.md`를 따른다.
> 이 문서에는 **이 저장소에서만 통하는 사실과 함정**만 적는다.

## 이 저장소는 무엇인가

`admin.posselect.com`을 서비스하는 Next.js(App Router) **직원용 백오피스**다. 상품/카테고리/주문
관리 화면과, 그 화면이 부르는 자체 API 라우트를 함께 갖는다. K3s에는 `customer` 네임스페이스의
`deployment/admin-front`로 떠 있다.

```
app/admin/{products,categories,orders}   화면 (products: 목록/신규/수정 + ProductForm, VariantManager)
app/api/admin/**                         product-api / order-api로 중계하는 자체 API 라우트
app/api/{login,logout}                   Keycloak staff realm 직접 로그인 / 쿠키 삭제
app/login                                로그인 화면
middleware.ts                            인증 + RBAC 게이트 (이 저장소의 보안 경계 전부)
lib/auth.ts                              ADMIN_ACCESS_TOKEN 검증 (staff realm JWKS)
lib/menu.ts                              메뉴 트리 = RBAC/ABAC 규칙 정의
lib/backend.ts                           product-api / order-api 클러스터 내부 주소 + Bearer 헤더
components/auth/RequirePermission.tsx    서버 컴포넌트용 권한 게이트
```

다른 프론트 3곳과 달리 **자체 route handler가 많고, 서버사이드에서 백엔드 API를 직접 호출한다**
(`~/msa/customer/networkpolicy.yaml`의 `allow-order-api` / `allow-product-api`에 `app: admin-front`가
등록돼 있는 이유).

## 인증/인가: 게이트웨이가 아니라 이 저장소가 전부 책임진다

**이 저장소는 게이트웨이 주입 헤더(`X-User-Id` / `X-User-Email` / `X-User-Role` / `X-User-Name`)를
전혀 읽지 않는다** (`grep -rn "X-User" app lib components` → 0건). 그리고 그래야 맞다:

- `admin.posselect.com`은 게이트웨이의 `protected-hosts`(=`customer.posselect.com`)에도
  `optional-auth-hosts`(=`product.posselect.com`)에도 **없다.** 따라서 `JwtAuthenticationFilter`는
  이 호스트에 대해 `X-User-*`를 **제거만 하고 아무것도 주입하지 않는다.**
- 인증은 전적으로 `middleware.ts`가 한다: `ADMIN_ACCESS_TOKEN` 쿠키를 Keycloak **staff** realm
  (`https://keycloak.posselect.com/realms/staff`) JWKS로 직접 검증(`lib/auth.ts`). 고객용
  `ACCESS_TOKEN`(customer realm)과는 완전히 별개의 쿠키/realm이다.
- 백엔드 호출은 그 staff 토큰을 `Authorization: Bearer`로 그대로 전달하고, product-api/order-api가
  같은 JWKS로 **재검증**한다(`lib/backend.ts` 주석). 서비스 간 공유 비밀값이 없다.

→ 결론: 게이트웨이가 막아 줄 것이라 가정하지 말 것. **`middleware.ts`의 `matcher`가 이 앱의 보안
경계 그 자체다.**

## 실제 함정 (전부 이 저장소 코드/게이트웨이 설정에서 확인된 것)

### 1. `middleware.ts`의 `matcher` 밖은 통째로 무인증이다

```ts
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
```

이 두 프리픽스 밖에 새 페이지나 API를 만들면 **로그인 검사 자체가 걸리지 않는다.** 게다가
`app/api/admin/products/route.ts`의 `POST`는
`request.cookies.get("ADMIN_ACCESS_TOKEN")!.value`처럼 **non-null 단언**을 쓰는데, 이게 안전한 유일한
근거가 미들웨어의 사전 검사다. 라우트를 `/api/admin/**` 밖으로 옮기거나 이름을 바꾸면 RBAC과 이
전제가 동시에 사라진다.

### 2. 인가는 deny-by-default다 — 규칙 없는 경로는 거부된다

`middleware.ts`는 인증 후 `resolveAccess(adminMenus, pathname)`로 적용할 규칙을 찾고,
**규칙을 못 찾으면 통과가 아니라 거부한다.** 새 화면이나 새 API를 추가하면 `lib/menu.ts`에
등록하기 전까지 403이 난다. 이는 버그가 아니라 의도된 동작이다 — 등록을 잊었을 때
"조용히 무방비"가 아니라 "눈에 띄게 막힘"이 되도록 뒤집어 놓은 것이다.

**등록 방법** (`lib/menu.ts`의 `adminMenus`):

- 화면 경로는 `href`에, **그 화면이 호출하는 API 경로는 `apiPrefixes`에** 넣는다. 둘 다 필요하다.
  화면에만 역할을 걸고 API를 비워 두면 API를 직접 호출해 우회할 수 있다.
- 매칭은 세그먼트 경계까지 본다(`resolveAccess` → `matchesPrefix`). `/admin/products-secret`은
  `/admin/products` 규칙을 물려받지 않는다.

**왜 이렇게 되어 있는가 (admin.front#12, 2026-08-21 수정).** 이전 구현은 규칙을 못 찾으면
`NextResponse.next()`로 통과시켰고, 규칙 탐색이 화면 경로만 봤다. `"/api/admin/products"`는
`"/admin/products"`로 시작하지 않으므로 어떤 규칙에도 매칭되지 않았고, 결과적으로 **관리 API
전체가 인증만 되면 역할과 무관하게 호출 가능**했다. deny 분기 안에 API 전용 403 응답 코드가
있었던 것으로 보아 검사 대상으로 의도는 되어 있었으나 도달할 수 없는 코드였다.

`hasPermission`은 `requiredRoles`가 비어 있으면 `true`를 반환한다 — "역할 미지정 = 전원 허용"이다.
따라서 메뉴 항목을 추가하면서 `requiredRoles`를 빠뜨리면 인증된 staff 전원에게 열린다.
규칙 자체를 등록하지 않는 것과는 다른 결과이니 주의할 것.

### 3. 게이트웨이가 페이지 경로의 쓰기 요청만 막는다 → Server Action 금지

게이트웨이에는 이 호스트용으로 세 라우트가 순서대로 있다:

1. `admin-front-api` — `Path=/api/**`를 먼저 통과시킨다(그래서 관리자 로그인/상품 관리가 동작).
2. `admin-front-block-write` — 나머지 경로의 POST/PUT/PATCH/DELETE를 `SetStatus=403` (msa #155 대응).
3. `admin-front` — catch-all.

즉 **Server Action(페이지 URL로 POST)은 프로덕션에서 403**이 된다. 쓰기는 지금처럼
`app/api/admin/**` route handler로만 할 것. 로컬 dev는 게이트웨이를 안 거쳐서 멀쩡히 돌아가므로
배포 후에야 드러난다.

### 4. `package-lock.json`이 없다 → 빌드가 재현되지 않는다

이 저장소만 lock 파일이 없다. `Dockerfile`이 `npm install`을 돌리므로 빌드 시점마다 의존성이 새로
해석되고, `"@posselect/ui": "github:lee-dohyun/posselect-ui"`는 **버전이 고정되지 않은 git 의존성**이라
같은 커밋을 다시 빌드해도 결과가 달라질 수 있다. 의존성 관련 이상 증상을 코드에서 찾기 전에 이걸
먼저 의심할 것.

### 5. `@posselect/ui` 변경은 자동 반영되지 않는다

`next.config.ts`의 `transpilePackages: ["@posselect/ui"]`. posselect-ui를 고쳐도 **이 저장소를 다시
빌드해야** 반영된다(소비 저장소 5곳 각각). 이 저장소는 `Nav`, `Button`, `Field`, `Input` 등을 쓴다.
그리고 **정의되지 않은 CSS 변수는 조용히 죽는다** — `tokens.css`에 없는 변수를 배경색으로 쓰면 에러
없이 배경이 투명해진다(hero 배너 인시던트). `app/layout.tsx`가 쓰는 `var(--color-divider)`처럼
새 토큰을 쓰기 전에 posselect-ui의 정의를 먼저 확인할 것.

### 6. 프로덕션 이미지는 최상위 파일을 골라서만 복사한다

`Dockerfile`의 production 스테이지는 `.next`, `node_modules`, `package.json`, `public`만 COPY하고
**`next.config.ts`는 복사하지 않는다.** 지금은 `transpilePackages`(빌드 타임 전용)만 있어서 문제가
없지만, `images`/`rewrites`/`headers` 같은 런타임 설정을 추가하면 Dockerfile도 같이 고쳐야 한다
(next.config.ts 누락으로 상품 이미지가 안 뜬 2026-08-20 `store.front` 사례).

### 7. CI는 타입/린트를 안 본다. main push = 즉시 프로덕션

`.github/workflows/docker-image.yml`은 Docker 빌드/푸시 성공만을 게이트로 삼고 `lint`/`typecheck`를
돌리지 않는다(Trivy도 `exit-code: "0"` 리포트 전용). 이어지는 `deploy` 잡이 self-hosted 러너에서
`kubectl set image deployment/admin-front -n customer`를 실행한다.

→ push 전에 로컬에서 반드시 실행:

```bash
npm run typecheck   # tsc --noEmit
npm run lint
```

`.claude/hooks/pre-push-verify.sh`가 PreToolUse 훅으로 이걸 강제한다(정당한 사유가 있을 때만
`CLAUDE_SKIP_PUSH_VERIFY=1`).

## 작업 기록

`~/msa/AGENTS.md` §4의 Task Execution Workflow를 따른다. 이 저장소에 한정된 주의:

- **Draft Issue를 만들지 말 것.** 저장소에 연결되지 않은 Draft 카드는 추적이 끊기고, 과거 중복 카드가
  210여 건 쌓인 사고가 있었다. 반드시 `gh issue create -R lee-dohyun/admin.front ...`로 **실제 저장소
  이슈**를 만든 뒤 GitHub Project #2에 연결하고 Status를 `In Progress`로 바꾼 다음 코드를 건드린다.
  (`gh`는 풀 경로 `~/.local/bin/gh`.)
- 완료 시 커밋 메시지의 `Closes #N` 또는 `gh issue close`로 반드시 닫는다.
- 상세 절차는 `msa-work-log` 스킬(사용자 레벨, 이 저장소 세션에서도 로드됨)을 따른다.

## 커밋

- 주석/문서 스타일은 `docs/COMMENT_STANDARDS.md`를 따른다.
- 문서·설정만 바꾼 커밋은 메시지 끝에 `[skip ci]` — 안 붙이면 불필요한 프로덕션 배포가 돈다.
