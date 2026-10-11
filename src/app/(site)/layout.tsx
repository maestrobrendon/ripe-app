import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "@/brand/fonts";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { getUserBaskets } from "@/lib/basket";
import { SHOPPING_WINDOW_DAY_SHORT_LABEL } from "@/lib/shopping-window";
import { CartProvider } from "@/components/cart-provider";
import { DestinationProvider, type DestinationBasket } from "@/components/destination-provider";
import { DestinationToast } from "@/components/destination-pill";
import { ZoneProvider } from "@/components/zone-gate";
import { SiteHeader } from "@/components/site-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AnnouncementBar } from "@/components/announcement-bar";
import { PrimaryMobileNav } from "@/components/primary-mobile-nav";
import { MotionProvider } from "@/components/motion-provider";
import { KachiBubble } from "@/components/kachi/kachi-bubble";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Shop fruits and vegetables sourced locally from trusted farmers, delivered across Lagos. Subscribe for member pricing and a standing weekly basket.",
};

/**
 * Root layout for every page with the shop chrome. The homepage and sign-up
 * draw their own, under (bare)/layout.tsx, which explains why the two are
 * separate root layouts.
 */
export default async function SiteRootLayout({ children }: { children: React.ReactNode }) {
  const [user, cart, zone] = await Promise.all([getCurrentUser(), readCart(), getActiveZone()]);

  let destinationBaskets: DestinationBasket[] = [];
  if (user) {
    const allBaskets = await getUserBaskets(user.id);
    destinationBaskets = allBaskets.map((b) => ({
      id: b.id,
      label: b.goalTag || (b.shoppingWindowDay ? `${SHOPPING_WINDOW_DAY_SHORT_LABEL[b.shoppingWindowDay]} basket` : "Basket"),
    }));
  }

  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      {/* Guests have no bottom menu, so nothing fixed to the bottom of the
          screen needs to clear one: --mobile-nav-h is zero for them. */}
      <body className="flex min-h-full flex-col" style={user ? undefined : ({ "--mobile-nav-h": "0px" } as React.CSSProperties)}>
        <MotionProvider>
          <ZoneProvider initialZoneName={zone?.name ?? null}>
            <CartProvider initial={cart}>
              <DestinationProvider signedIn={Boolean(user)} baskets={destinationBaskets}>
                {/* The "Freshly selected..." banner is marketing for guests only. */}
                {!user && <AnnouncementBar />}
                <SiteHeader signedIn={Boolean(user)} />
                {/* A signed-in visitor always gets the floating dock below,
                    whose real footprint is --dock-clearance (pb-dock zeroes
                    it on desktop, where the dock is a left rail instead of a
                    bottom bar). A guest has no bottom menu to clear. */}
                <main className={user ? "flex-1 pb-dock" : "flex-1"}>
                  {children}
                </main>
                {/* Signed-in users get every former footer link from Account →
                    Help and info instead; a footer under the bottom nav read like
                    a website, not the app (Basket vs. Cart addendum, Section 6). */}
                {!user && <MarketingFooter />}
                <CartDrawer />
                <DestinationToast />
                <PrimaryMobileNav signedIn={Boolean(user)} />
                <KachiBubble signedIn={Boolean(user)} firstName={user?.name.trim().split(/\s+/)[0] ?? null} />
              </DestinationProvider>
            </CartProvider>
          </ZoneProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
