import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { adminMenus, hasPermission, resolveAccess } from "@/lib/menu";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

/**
 * [인증 + 인가 미들웨어]
 *
 * `admin.posselect.com`은 게이트웨이의 `protected-hosts`/`optional-auth-hosts` 어디에도 없어
 * 신원 헤더가 주입되지 않는다. 즉 이 미들웨어가 이 저장소의 보안 경계 **전부**다.
 *
 * 인가는 **deny-by-default**로 동작한다. `lib/menu.ts`에 규칙이 정의되지 않은 경로는
 * 통과가 아니라 거부다.
 *
 * 왜 그렇게 바꿨는가(2026-08-21, admin.front#12): 이전 구현은 규칙을 못 찾으면
 * `NextResponse.next()`로 통과시켰다. 그런데 규칙 탐색이 화면 경로(`/admin/products` 등)만
 * 보고 있어서 `/api/admin/**`은 어떤 규칙에도 매칭되지 않았고, 결과적으로 **관리 API 전체가
 * 인증만 되면 역할과 무관하게 호출 가능**했다. 화면에서 버튼이 안 보이는 것과 API가 막히는 것은
 * 다른 문제이며, 우회는 API를 직접 부르면 그만이었다.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");

  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")?.value;
  const claims = token ? await verifyAdminToken(token) : null;

  // 1) 인증
  if (!claims) {
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2) 인가 — 규칙이 없으면 거부한다
  const access = resolveAccess(adminMenus, pathname);
  if (!access) {
    console.warn(
      `[RBAC/middleware] 접근 규칙 미정의로 거부 - 속성: { path: "${pathname}", ` +
        `userEmail: "${claims.email}" }. lib/menu.ts 에 이 경로의 href 또는 apiPrefixes 를 등록해야 합니다.`
    );
    return deny(isApi);
  }

  if (!hasPermission(access.requiredRoles, claims.roles, access.requiredAttributes, claims.attributes)) {
    console.warn(
      `[RBAC/middleware] 권한 거부 - 속성: { path: "${pathname}", userEmail: "${claims.email}", ` +
        `roles: [${claims.roles.join(",")}], attributes: ${JSON.stringify(claims.attributes || {})} }`
    );
    return deny(isApi);
  }

  return NextResponse.next();
}

function deny(isApi: boolean) {
  if (isApi) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return new NextResponse("Forbidden - Access Denied", { status: 403 });
}
