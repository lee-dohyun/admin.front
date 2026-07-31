import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}`, { cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${PRODUCT_API_URL}/api/products/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  return new NextResponse(null, { status: res.status });
}
