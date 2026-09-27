import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { getActiveBasketReadOnly, getBasketItemCount } from "@/lib/basket";
import { SHOPPING_WINDOW_DAY_SHORT_LABEL } from "@/lib/shopping-window";
import { CartProvider } from "@/components/cart-provider";
import { ZoneProvider } from "@/components/zone-gate";
import { SiteHeader, type MemberStatus } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AnnouncementBar } from "@/components/announcement-bar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

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
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Shop fruits and vegetables sourced locally from trusted farmers, delivered across Lagos. Subscribe for member pricing and a standing weekly basket.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, cart, zone] = await Promise.all([getCurrentUser(), readCart(), getActiveZone()]);

  let member: MemberStatus | null = null;
  if (user) {
    const activeBasket = await getActiveBasketReadOnly(user.id);
    const itemCount = activeBasket ? await getBasketItemCount(activeBasket.id) : 0;
    member = {
      firstInitial: user.name.trim().charAt(0).toUpperCase() || "?",
      shipDayLabel: activeBasket?.shoppingWindowDay
        ? SHOPPING_WINDOW_DAY_SHORT_LABEL[activeBasket.shoppingWindowDay]
        : null,
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
            {/* var(--mobile-nav-h) accounts for the fixed tab bar below,
                which only renders under sm — see globals.css. */}
            <main className="flex-1" style={{ paddingBottom: "var(--mobile-nav-h)" }}>
              {children}
            </main>
            <SiteFooter />
            <CartDrawer />
            <MobileBottomNav signedIn={Boolean(user)} />
          </CartProvider>
        </ZoneProvider>
      </body>
    </html>
  );
}
