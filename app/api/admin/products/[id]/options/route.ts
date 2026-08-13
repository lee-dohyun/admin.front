import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}/options`, {
    method: "POST",
    headers: adminHeaders(token),
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
