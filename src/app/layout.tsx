import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { getStandingBasketItemCount } from "@/lib/basket";
import { SHOPPING_WINDOW_DAY_SHORT_LABEL } from "@/lib/shopping-window";
import { CartProvider } from "@/components/cart-provider";
import { ZoneProvider } from "@/components/zone-gate";
import { SiteHeader, type MemberStatus } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AnnouncementBar } from "@/components/announcement-bar";

// Stands in for Ozik. Dr Kabel is a locally installed single-weight display
// face, so it's self-hosted here rather than pulled from Google Fonts.
const drKabel = localFont({
  src: "../fonts/DrKabel.otf",
  variable: "--font-dr-kabel",
  weight: "400",
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SITE_NAME}. ${SITE_TAGLINE}`,
  description:
    "Shop fruits and vegetables sourced locally from trusted farmers, delivered across Lagos. Subscribe for member pricing and a standing weekly basket.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, cart, zone] = await Promise.all([getCurrentUser(), readCart(), getActiveZone()]);

  let member: MemberStatus | null = null;
  if (user) {
    const itemCount = await getStandingBasketItemCount(user.id);
    member = {
      firstInitial: user.name.trim().charAt(0).toUpperCase() || "?",
      shipDayLabel: user.shoppingWindowDay ? SHOPPING_WINDOW_DAY_SHORT_LABEL[user.shoppingWindowDay] : null,
      zoneName: user.deliveryZone?.name ?? null,
      itemCount,
    };
  }

  return (
    <html lang="en" className={`${drKabel.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ZoneProvider initialZoneName={zone?.name ?? null}>
          <CartProvider initial={cart}>
            <AnnouncementBar />
            <SiteHeader member={member} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <CartDrawer />
          </CartProvider>
        </ZoneProvider>
      </body>
    </html>
  );
}
