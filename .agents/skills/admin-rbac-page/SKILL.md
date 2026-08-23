---
name: admin-rbac-page
description: >-
  Add a new admin page with RBAC (Role-Based Access Control) integration to admin.front.
  Use when the user asks to create a new management page, dashboard section, or protected
  admin feature that requires permission checks.
---

# 관리자 페이지 + 권한 연동 체크리스트

## 전제

- Next.js App Router
- JWT 기반 인증 (`auth.api` 발급)
- 역할 기반 권한 제어 (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `VIEWER`)
- `RequirePermission` 컴포넌트로 권한 게이팅

## 절차

### 1. 페이지 파일 생성

```
app/<page-name>/
├── page.tsx
└── layout.tsx  # 권한 체크 포함
```

### 2. 권한 게이팅

```tsx
import { RequirePermission } from '@/components/auth/RequirePermission';

export default function NewAdminPage() {
  return (
    <RequirePermission permission="MANAGE_PRODUCTS">
      {/* 페이지 내용 */}
    </RequirePermission>
  );
}
```

### 3. 메뉴 등록

[`lib/menu.ts`](file:///home/leedohyun/git/admin.front/lib/menu.ts) 에 메뉴 항목 추가:

```typescript
{
  label: '새 메뉴',
  href: '/new-page',
  icon: IconName,
  requiredPermission: 'MANAGE_PRODUCTS',
}
```

### 4. 미들웨어 확인

[`middleware.ts`](file:///home/leedohyun/git/admin.front/middleware.ts) 에서 새 경로가 인증 체크 대상에 포함되는지 확인.

### 5. API 연동

- API 호출 시 [`lib/auth.ts`](file:///home/leedohyun/git/admin.front/lib/auth.ts) 의 인증 헤더 유틸리티 사용
- 에러 응답 (401/403) 핸들링 포함

### 6. 검증

```bash
npm run typecheck && npm run build
# 각 역할로 로그인하여 접근 권한 확인
```
