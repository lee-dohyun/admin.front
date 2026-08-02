import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "관리자",
  description: "posselect.com 쇼핑몰 관리자",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b p-4 flex justify-between items-center max-w-5xl mx-auto">
          <Link href="/admin/products" className="font-bold">
            관리자
          </Link>
          <div className="flex gap-4">
            <Link href="/admin/products" className="text-sm text-gray-600 hover:text-black">
              상품 관리
            </Link>
            <Link href="/admin/orders" className="text-sm text-gray-600 hover:text-black">
              주문 관리
            </Link>
            <a href="/api/logout" className="text-sm text-gray-600 hover:text-black">
              로그아웃
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
