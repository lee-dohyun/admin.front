import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { parseStatusFilter } from "@/lib/submissions";

export async function GET(request: NextRequest) {
  const status = parseStatusFilter(request.nextUrl.searchParams.get("status"));
  if (status === "invalid") return NextResponse.json({ error: "unknown status" }, { status: 400 });

  const qs = status ? `?status=${status}` : "";
  const res = await fetch(`${PRODUCT_API_URL}/api/submissions${qs}`, {
    cache: "no-store",
    headers: adminHeaders(adminToken(request)),
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
