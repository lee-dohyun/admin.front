import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { adminMenus, hasPermission, MenuItem } from "@/lib/menu";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

function findMenu(menus: MenuItem[], pathname: string): MenuItem | undefined {
  for (const menu of menus) {
    if (pathname.startsWith(menu.href)) {
      return menu;
    }
    if (menu.children) {
      const found = findMenu(menu.children, pathname);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * [메뉴 권한 검사 미들웨어]
 * Keycloak JWT에서 추출한 권한을 기반으로 접근 권한을 확인하여,
 * 권한이 없는 사용자가 관리자 페이지나 API에 접근하는 것을 원천 차단하기 위해 실행됩니다.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")?.value;
  const claims = token ? await verifyAdminToken(token) : null;
  
  if (claims) {
    const pathname = request.nextUrl.pathname;
    const menu = findMenu(adminMenus, pathname);
    if (menu && !hasPermission(menu.requiredRoles, claims.roles)) {
      console.warn(`[RBAC/middleware] 권한 거부 - 속성: { path: "${pathname}", userEmail: "${claims.email}", roles: [${claims.roles.join(',')}] }`);
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return new NextResponse("Forbidden - Access Denied", { status: 403 });
    }
    return NextResponse.next();
  }
  
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
