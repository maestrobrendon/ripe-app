import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
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
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AnnouncementBar } from "@/components/announcement-bar";
import { PrimaryMobileNav } from "@/components/primary-mobile-nav";
import { MotionProvider } from "@/components/motion-provider";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Shop fruits and vegetables sourced locally from trusted farmers, delivered across Lagos. Subscribe for member pricing and a standing weekly basket.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The new homepage (see src/proxy.ts) draws its own navigation and footer.
  if ((await headers()).get("x-basket-bare") === "1") {
    return (
      // hn-page lets sticky sections work (see home-next.css); the pre-paint
      // script adds hn-js to <html>, hence suppressHydrationWarning.
      <html lang="en" className={`${fontVariables} hn-page antialiased`} suppressHydrationWarning>
        <body>
          <MotionProvider>{children}</MotionProvider>
        </body>
      </html>
    );
  }

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
      <body className="flex min-h-full flex-col">
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
                    bottom bar); a guest gets the flush tab bar's fixed
                    --mobile-nav-h instead — see globals.css. */}
                <main className={user ? "flex-1 pb-dock" : "flex-1"} style={user ? undefined : { paddingBottom: "var(--mobile-nav-h)" }}>
                  {children}
                </main>
                {/* Signed-in users get every former footer link from Account →
                    Help and info instead; a footer under the bottom nav read like
                    a website, not the app (Basket vs. Cart addendum, Section 6). */}
                {!user && <SiteFooter />}
                <CartDrawer />
                <DestinationToast />
                <PrimaryMobileNav signedIn={Boolean(user)} />
              </DestinationProvider>
            </CartProvider>
          </ZoneProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
