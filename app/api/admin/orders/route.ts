import { NextRequest } from "next/server";
import { ORDER_API_URL, adminHeaders, adminToken, relay } from "@/lib/backend";

// 주문 목록 — 상태·기간·검색어·페이지 쿼리를 그대로 넘긴다(gateway#329). 응답은 페이지 객체다.
export async function GET(request: NextRequest) {
  const res = await fetch(`${ORDER_API_URL}/api/orders?${request.nextUrl.searchParams.toString()}`, {
    headers: adminHeaders(adminToken(request)),
    cache: "no-store",
  });
  return relay(res);
}
