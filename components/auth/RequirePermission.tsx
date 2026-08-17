import React from "react";
import { Role, hasPermission } from "@/lib/menu";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";

export interface RequirePermissionProps {
  roles?: Role[];
  attributes?: Record<string, string | string[]>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * [RequirePermission 서버 컴포넌트]
 * 지정된 역할(RBAC) 또는 속성(ABAC)을 충족하는 사용자에게만 children을 렌더링합니다.
 * 조건을 만족하지 않으면 fallback(기본값 null)을 렌더링합니다.
 */
export async function RequirePermission({
  roles,
  attributes,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("ADMIN_ACCESS_TOKEN")?.value;
  const claims = token ? await verifyAdminToken(token) : null;

  if (!claims) {
    return <>{fallback}</>;
  }

  const allowed = hasPermission(roles, claims.roles, attributes, claims.attributes);
  
  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
