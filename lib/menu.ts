export type Role = string;

export interface MenuItem {
  title: string;
  href: string;
  /**
   * 이 메뉴가 관장하는 API 경로 접두사.
   *
   * 미들웨어의 인가 판정은 화면 경로(`href`)와 이 목록을 **함께** 본다. 화면에만 역할 검사를
   * 걸고 그 화면이 호출하는 API를 비워 두면, API를 직접 호출해 우회할 수 있기 때문이다.
   * 새 관리 API를 추가하면 반드시 여기에도 등록해야 한다 — 등록하지 않은 경로는
   * `resolveAccess`가 매칭하지 못하고, 미들웨어는 그런 경로를 **거부**한다.
   */
  apiPrefixes?: string[];
  /**
   * 이 메뉴와 `apiPrefixes`에 접근할 수 있는 역할. **선택 항목이 아니다.**
   *
   * `hasPermission`은 목록이 비어 있으면 `true`를 반환한다 — 즉 역할을 적지 않은 항목은
   * 인증된 staff 전원에게 열린다. 규칙을 아예 등록하지 않으면 거부되는 것과 정반대 결과라
   * 리뷰에서 눈치채기 어렵다. 그래서 타입 단계에서 누락을 막는다.
   * 전원 공개가 실제 의도라면 `[]`를 명시적으로 적어 의도를 드러낼 것.
   */
  requiredRoles: Role[];
  requiredAttributes?: Record<string, string | string[]>;
  children?: MenuItem[];
}

export const adminMenus: MenuItem[] = [
  {
    title: "상품 관리",
    href: "/admin/products",
    apiPrefixes: ["/api/admin/products"],
    requiredRoles: ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
  },
  {
    title: "카테고리 관리",
    href: "/admin/categories",
    apiPrefixes: ["/api/admin/categories"],
    requiredRoles: ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
  },
  {
    title: "주문 관리",
    href: "/admin/orders",
    apiPrefixes: ["/api/admin/orders"],
    requiredRoles: ["ORDER_MANAGER", "SYSTEM_ADMIN"],
  },
];

/**
 * [경로 접두사 매칭]
 * 경로가 접두사와 같거나, 접두사의 하위 경로인지 판정한다.
 *
 * 단순 `startsWith`를 쓰지 않는 이유: `"/admin/products-secret".startsWith("/admin/products")`가
 * `true`가 되어, 이름이 비슷할 뿐인 별개 경로가 남의 권한 규칙을 물려받는다.
 * 세그먼트 경계(`/`)까지 확인해야 한다.
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * [접근 정책 해석]
 * 경로에 적용할 메뉴 항목(= 역할/속성 규칙)을 찾는다. 화면 경로와 API 경로를 모두 본다.
 *
 * 반환값이 `undefined`이면 **규칙이 정의되지 않은 경로**라는 뜻이며, 호출부는 이를
 * 통과가 아니라 거부로 처리해야 한다(deny-by-default). 규칙 없는 경로를 통과시키면
 * 새 화면이나 새 API를 추가할 때마다 조용히 무방비 상태가 된다.
 */
export function resolveAccess(menus: MenuItem[], pathname: string): MenuItem | undefined {
  for (const menu of menus) {
    // 자식이 더 구체적인 규칙을 가질 수 있으므로 자식을 먼저 본다.
    if (menu.children) {
      const found = resolveAccess(menu.children, pathname);
      if (found) return found;
    }
    if (matchesPrefix(pathname, menu.href)) return menu;
    if (menu.apiPrefixes?.some((prefix) => matchesPrefix(pathname, prefix))) return menu;
  }
  return undefined;
}

/**
 * [권한 검사 로직]
 * 요구되는 권한 목록 중 하나라도 보유하고 있는지 검사합니다.
 * Role-Based Access Control(RBAC) 체계에서 인가되지 않은 라우트 접근을 막고, 
 * 네비게이션 항목을 숨김 처리하기 위한 목적으로 사용됩니다.
 * 
 * @param requiredRoles 메뉴에 필요한 역할 목록
 * @param userRoles 사용자가 보유한 역할 목록
 * @param requiredAttributes 메뉴에 필요한 속성 조건 (ABAC)
 * @param userAttributes 사용자가 보유한 속성 목록 (ABAC)
 */
export function hasPermission(
  requiredRoles?: Role[], 
  userRoles?: Role[],
  requiredAttributes?: Record<string, string | string[]>,
  userAttributes?: Record<string, string | string[]>
): boolean {
  // 1. RBAC 검사
  if (requiredRoles && requiredRoles.length > 0) {
    if (!userRoles || userRoles.length === 0) return false;
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) return false;
  }

  // 2. ABAC 검사
  if (requiredAttributes && Object.keys(requiredAttributes).length > 0) {
    if (!userAttributes) return false;

    for (const [key, expectedValue] of Object.entries(requiredAttributes)) {
      const userValue = userAttributes[key];
      if (userValue === undefined) return false;

      const expectedArr = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
      const userArr = Array.isArray(userValue) ? userValue : [userValue];

      const hasMatch = expectedArr.some(val => userArr.includes(val));
      if (!hasMatch) return false;
    }
  }

  return true;
}

/**
 * [동적 메뉴 렌더링 필터]
 * 전체 메뉴 트리에서 사용자의 권한에 부합하는 메뉴만 필터링합니다.
 * 클라이언트 단에서 접근 불가한 메뉴를 노출하지 않기 위해(보안 및 UX 목적) 사용됩니다.
 * 
 * @param menus 전체 메뉴 트리
 * @param userRoles 사용자 보유 역할 목록
 * @param userAttributes 사용자 보유 속성 목록 (ABAC)
 */
export function filterMenus(
  menus: MenuItem[], 
  userRoles?: Role[],
  userAttributes?: Record<string, string | string[]>
): MenuItem[] {
  return menus
    .filter((menu) => hasPermission(menu.requiredRoles, userRoles, menu.requiredAttributes, userAttributes))
    .map((menu) => {
      if (menu.children && menu.children.length > 0) {
        return {
          ...menu,
          children: filterMenus(menu.children, userRoles, userAttributes),
        };
      }
      return menu;
    });
}
