import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@posselect/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "관리자",
  description: "posselect.com 쇼핑몰 관리자",
  icons: {
    icon: "https://image.posselect.com/cdn/favicons/favicon-transparent-red-256.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div
          className="max-w-5xl mx-auto"
          style={{ borderBottom: "1px solid var(--color-divider)" }}
        >
          <Nav brand="관리자">
            <Link href="/admin/products">상품 관리</Link>
            <Link href="/admin/orders">주문 관리</Link>
            <a href="/api/logout">로그아웃</a>
          </Nav>
        </div>
        {children}
      </body>
    </html>
  );
}
