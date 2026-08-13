import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { id, variantId } = await params;
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}/variants/${variantId}`, {
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
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { id, variantId } = await params;
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}/variants/${variantId}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
  return new NextResponse(null, { status: res.status });
}
