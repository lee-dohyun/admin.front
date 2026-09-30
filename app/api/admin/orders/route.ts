import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, relay } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const res = await fetch(`${ORDER_API_URL}/api/orders`, {
    headers: adminHeaders(token),
    cache: "no-store",
  });
  return relay(res);
}
