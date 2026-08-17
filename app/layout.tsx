import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Nav } from "@posselect/ui";
import { verifyAdminToken } from "@/lib/auth";
import { adminMenus, filterMenus } from "@/lib/menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "관리자",
  description: "posselect.com 쇼핑몰 관리자",
  icons: {
    icon: "https://image.posselect.com/cdn/favicons/favicon-transparent-red-256.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("ADMIN_ACCESS_TOKEN")?.value;
  const claims = token ? await verifyAdminToken(token) : null;
  const permittedMenus = filterMenus(adminMenus, claims?.roles || []);

  return (
    <html lang="ko">
      <body>
        <div
          className="max-w-5xl mx-auto"
          style={{ borderBottom: "1px solid var(--color-divider)" }}
        >
          <Nav brand="관리자">
            {permittedMenus.map((menu) => (
              <Link key={menu.href} href={menu.href}>
                {menu.title}
              </Link>
            ))}
            <a href="/api/logout">로그아웃</a>
          </Nav>
        </div>
        {children}
      </body>
    </html>
  );
}
