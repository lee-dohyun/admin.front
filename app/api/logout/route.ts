import { NextResponse } from "next/server";

export async function GET() {
  // `NextResponse.redirect(new URL("/login", request.url))` 를 쓰지 않는다 — 이 앱은 게이트웨이 뒤에서
  // 돌아 request.url 이 사용자가 접속한 주소가 아니라 `localhost:3000` 이라, 그렇게 만든 절대 주소로
  // 리다이렉트하면 사용자가 열리지 않는 `https://localhost:3000/login` 으로 간다(gateway#283).
  // 상대 경로 Location 은 브라우저가 현재 주소 기준으로 해석한다.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  response.cookies.delete("ADMIN_ACCESS_TOKEN");
  return response;
}
