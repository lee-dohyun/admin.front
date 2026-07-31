import { NextRequest, NextResponse } from "next/server";
import { ORDER_API_URL, adminHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const res = await fetch(`${ORDER_API_URL}/api/orders`, {
    headers: adminHeaders(token),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
