export type Role = string;

export interface MenuItem {
  title: string;
  href: string;
  requiredRoles?: Role[];
  requiredAttributes?: Record<string, string | string[]>;
  children?: MenuItem[];
}

export const adminMenus: MenuItem[] = [
  {
    title: "상품 관리",
    href: "/admin/products",
    requiredRoles: ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
  },
  {
    title: "카테고리 관리",
    href: "/admin/categories",
    requiredRoles: ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
  },
  {
    title: "주문 관리",
    href: "/admin/orders",
    requiredRoles: ["ORDER_MANAGER", "SYSTEM_ADMIN"],
  },
];

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
