import { NextRequest } from "next/server";
import { AUTH_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

type Ctx = { params: Promise<{ code: string }> };

/** 등급 정책 수정(이름·할인율·기준액·정렬 순서). 검증과 적용 시점은 auth.api `AdminMemberGradeService` 가 정한다. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { code } = await params;
  const res = await fetch(`${AUTH_API_URL}/api/admin/member-grades/${encodeURIComponent(code)}`, {
    method: "PUT",
    headers: adminHeaders(adminToken(request)),
    body: await request.text(),
    cache: "no-store",
  });
  return relay(res);
}

/** 등급 삭제. 기본 등급·쓰이고 있는 등급은 auth.api 가 409 로 거부한다. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { code } = await params;
  const res = await fetch(`${AUTH_API_URL}/api/admin/member-grades/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}
