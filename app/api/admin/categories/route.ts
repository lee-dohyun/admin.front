import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders } from "@/lib/backend";

export async function GET() {
  const res = await fetch(`${PRODUCT_API_URL}/api/categories`, { cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const res = await fetch(`${PRODUCT_API_URL}/api/categories`, {
    method: "POST",
    headers: adminHeaders(),
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
