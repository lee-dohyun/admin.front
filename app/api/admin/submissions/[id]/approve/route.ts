import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { isValidId, validateReviewNote } from "@/lib/submissions";

// Server Action 이 아니라 route handler 다(admin.front#47): middleware 의 /api/admin/** 인가를 그대로 탄다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: { reviewNote?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // 본문 없음 = 메모 없음
  }
  const checked = validateReviewNote("approve", body.reviewNote);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const res = await fetch(`${PRODUCT_API_URL}/api/submissions/${id}/approve`, {
    method: "POST",
    headers: adminHeaders(adminToken(request)),
    body: JSON.stringify({ reviewNote: checked.note }),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
