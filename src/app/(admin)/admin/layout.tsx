import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "../../globals.css";
import { fontVariables } from "@/brand/fonts";

export const metadata: Metadata = {
  title: { default: "Basket Admin", template: "%s · Basket Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

/**
 * Root layout for the admin, a separate app in all but deployment: no shop
 * providers, header or cookies. Only reachable on ADMIN_HOST (src/proxy.ts),
 * which also sets the nonce CSP. Reading the request headers keeps every
 * admin page dynamically rendered, which the per-request nonce requires.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body className="min-h-svh bg-[#f6f7f5] text-carbon">{children}</body>
    </html>
  );
}
