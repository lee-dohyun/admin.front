import { describe, expect, it } from "vitest";
import { type MenuItem, hasPermission, resolveAccess } from "./menu";

describe("hasPermission", () => {
  describe("RBAC (역할) 검사", () => {
    it("requiredRoles가 undefined면 userRoles와 무관하게 허용한다", () => {
      expect(hasPermission(undefined, undefined)).toBe(true);
      expect(hasPermission(undefined, [])).toBe(true);
      expect(hasPermission(undefined, ["PRODUCT_MANAGER"])).toBe(true);
    });

    it("requiredRoles가 빈 배열이면(전원 공개 명시) 허용한다", () => {
      expect(hasPermission([], undefined)).toBe(true);
      expect(hasPermission([], [])).toBe(true);
    });

    it("requiredRoles가 있는데 userRoles가 undefined면 거부한다", () => {
      expect(hasPermission(["PRODUCT_MANAGER"], undefined)).toBe(false);
    });

    it("requiredRoles가 있는데 userRoles가 빈 배열이면 거부한다", () => {
      expect(hasPermission(["PRODUCT_MANAGER"], [])).toBe(false);
    });

    it("userRoles가 requiredRoles 중 어느 것도 포함하지 않으면 거부한다", () => {
      expect(hasPermission(["PRODUCT_MANAGER"], ["ORDER_MANAGER"])).toBe(false);
    });

    it("userRoles가 requiredRoles 중 하나라도 포함하면(OR) 허용한다", () => {
      expect(
        hasPermission(["PRODUCT_MANAGER", "SYSTEM_ADMIN"], ["SYSTEM_ADMIN"])
      ).toBe(true);
    });

    it("userRoles가 requiredRoles를 정확히 하나만 가져도 허용한다(부분 일치)", () => {
      expect(
        hasPermission(
          ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
          ["ORDER_MANAGER", "PRODUCT_MANAGER"]
        )
      ).toBe(true);
    });
  });

  describe("ABAC (속성) 검사", () => {
    it("requiredAttributes가 undefined면 역할만 통과해도 허용한다", () => {
      expect(hasPermission(undefined, undefined, undefined, undefined)).toBe(
        true
      );
    });

    it("requiredAttributes가 빈 객체면 허용한다", () => {
      expect(hasPermission(undefined, undefined, {}, undefined)).toBe(true);
    });

    it("requiredAttributes가 있는데 userAttributes가 undefined면 거부한다", () => {
      expect(
        hasPermission(undefined, undefined, { region: "seoul" }, undefined)
      ).toBe(false);
    });

    it("요구하는 속성 키가 userAttributes에 없으면 거부한다", () => {
      expect(
        hasPermission(undefined, undefined, { region: "seoul" }, { team: "a" })
      ).toBe(false);
    });

    it("문자열 대 문자열 속성값이 일치하면 허용한다", () => {
      expect(
        hasPermission(
          undefined,
          undefined,
          { region: "seoul" },
          { region: "seoul" }
        )
      ).toBe(true);
    });

    it("문자열 대 문자열 속성값이 불일치하면 거부한다", () => {
      expect(
        hasPermission(
          undefined,
          undefined,
          { region: "seoul" },
          { region: "busan" }
        )
      ).toBe(false);
    });

    it("요구값이 배열이고 사용자값이 그 중 하나를 포함하면(OR) 허용한다", () => {
      expect(
        hasPermission(
          undefined,
          undefined,
          { region: ["seoul", "busan"] },
          { region: "busan" }
        )
      ).toBe(true);
    });

    it("사용자값이 배열이고 요구값(문자열)을 포함하면 허용한다", () => {
      expect(
        hasPermission(
          undefined,
          undefined,
          { region: "seoul" },
          { region: ["seoul", "incheon"] }
        )
      ).toBe(true);
    });

    it("요구값 배열과 사용자값 배열의 교집합이 없으면 거부한다", () => {
      expect(
        hasPermission(
          undefined,
          undefined,
          { region: ["seoul", "busan"] },
          { region: ["daegu", "incheon"] }
        )
      ).toBe(false);
    });

    it("requiredAttributes에 여러 키가 있으면 전부(AND) 만족해야 허용한다", () => {
      const required = { region: "seoul", team: "a" };
      expect(
        hasPermission(undefined, undefined, required, {
          region: "seoul",
          team: "a",
        })
      ).toBe(true);
      // 하나만 만족하면 여전히 거부
      expect(
        hasPermission(undefined, undefined, required, {
          region: "seoul",
          team: "b",
        })
      ).toBe(false);
    });
  });

  describe("RBAC + ABAC 결합", () => {
    it("역할은 통과하지만 속성이 불일치하면 거부한다", () => {
      expect(
        hasPermission(
          ["PRODUCT_MANAGER"],
          ["PRODUCT_MANAGER"],
          { region: "seoul" },
          { region: "busan" }
        )
      ).toBe(false);
    });

    it("속성은 통과하지만 역할이 불일치하면 거부한다", () => {
      expect(
        hasPermission(
          ["PRODUCT_MANAGER"],
          ["ORDER_MANAGER"],
          { region: "seoul" },
          { region: "seoul" }
        )
      ).toBe(false);
    });

    it("역할과 속성이 모두 통과하면 허용한다", () => {
      expect(
        hasPermission(
          ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
          ["SYSTEM_ADMIN"],
          { region: "seoul" },
          { region: "seoul" }
        )
      ).toBe(true);
    });
  });
});

describe("resolveAccess / matchesPrefix (stretch)", () => {
  const menus: MenuItem[] = [
    {
      title: "상품 관리",
      href: "/admin/products",
      apiPrefixes: ["/api/admin/products"],
      requiredRoles: ["PRODUCT_MANAGER", "SYSTEM_ADMIN"],
      children: [
        {
          title: "상품 옵션 관리",
          href: "/admin/products/options",
          apiPrefixes: ["/api/admin/products/options"],
          requiredRoles: ["SYSTEM_ADMIN"],
        },
      ],
    },
    {
      title: "주문 관리",
      href: "/admin/orders",
      apiPrefixes: ["/api/admin/orders"],
      requiredRoles: ["ORDER_MANAGER", "SYSTEM_ADMIN"],
    },
  ];

  it("정확히 일치하는 화면 경로(href)에 규칙을 매칭한다", () => {
    expect(resolveAccess(menus, "/admin/products")?.title).toBe("상품 관리");
  });

  it("하위 경로도 세그먼트 경계 기준으로 매칭한다", () => {
    expect(resolveAccess(menus, "/admin/orders/123")?.title).toBe("주문 관리");
  });

  it("이름이 비슷할 뿐인 별개 경로는 매칭하지 않는다 (세그먼트 경계)", () => {
    expect(resolveAccess(menus, "/admin/products-secret")).toBeUndefined();
  });

  it("apiPrefixes 경로도 화면 경로와 동일하게 매칭한다", () => {
    expect(resolveAccess(menus, "/api/admin/orders/123")?.title).toBe(
      "주문 관리"
    );
  });

  it("자식 메뉴가 더 구체적인 규칙을 가지면 자식을 우선 매칭한다", () => {
    expect(resolveAccess(menus, "/admin/products/options")?.title).toBe(
      "상품 옵션 관리"
    );
  });

  it("규칙이 정의되지 않은 경로는 undefined를 반환한다 (deny-by-default 전제)", () => {
    expect(resolveAccess(menus, "/admin/unknown")).toBeUndefined();
  });
});
