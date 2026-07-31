import { NextResponse } from "next/server";
import { ORDER_API_URL, adminHeaders } from "@/lib/backend";

export async function GET() {
  const res = await fetch(`${ORDER_API_URL}/api/orders`, {
    headers: adminHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
