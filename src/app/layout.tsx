import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { CartProvider } from "@/components/cart-provider";
import { ZoneProvider } from "@/components/zone-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AnnouncementBar } from "@/components/announcement-bar";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ripe. Fruits and vegetables, delivered fresh across Lagos",
  description:
    "Shop fruits and vegetables sourced locally from trusted farmers, delivered across Lagos. Subscribe for member pricing and a standing weekly basket.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, cart, zone] = await Promise.all([getCurrentUser(), readCart(), getActiveZone()]);

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ZoneProvider initialZoneName={zone?.name ?? null}>
          <CartProvider initial={cart}>
            <AnnouncementBar />
            <SiteHeader isSignedIn={Boolean(user)} isSubscriber={Boolean(user?.subscriptionTierId)} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <CartDrawer />
            <WhatsAppWidget />
          </CartProvider>
        </ZoneProvider>
      </body>
    </html>
  );
}
