import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = (await params).id;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/admin/banners/${id}`, {
    method: "PUT",
    headers: adminHeaders(token),
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = (await params).id;
  const res = await fetch(`${PRODUCT_API_URL}/admin/banners/${id}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
  
  // DELETE might not return a body
  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
