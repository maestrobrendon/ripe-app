import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontVariables } from "@/brand/fonts";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { zoneForUser } from "@/lib/delivery";
import { CartProvider } from "@/components/cart-provider";
import { ZoneProvider } from "@/components/zone-gate";
import { SiteHeader } from "@/components/site-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteSettingsProvider } from "@/components/site-settings-provider";
import { getSiteSettings } from "@/lib/site-settings";
import { PrimaryMobileNav } from "@/components/primary-mobile-nav";
import { MotionProvider } from "@/components/motion-provider";
import { KachiBubble } from "@/components/kachi/kachi-bubble";
import { OfflineBanner } from "@/components/offline-banner";
import { AppSetup } from "@/components/app/app-setup";

export const metadata: Metadata = {
  // Installed on an iPhone's home screen, Basket opens full screen under its own name.
  appleWebApp: { capable: true, title: "Basket", statusBarStyle: "default" },
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Fruit and vegetables from trusted farmers, checked by hand and delivered across Lagos. Built around the recipes you want to cook.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

/**
 * Root layout for every page with the shop chrome. The homepage and sign-up
 * draw their own, under (bare)/layout.tsx, which explains why the two are
 * separate root layouts.
 */
export default async function SiteRootLayout({ children }: { children: React.ReactNode }) {
  const [user, cart, zone, settings] = await Promise.all([getCurrentUser(), readCart(), getActiveZone(), getSiteSettings()]);
  // A customer's area comes from their address, not the guest cookie.
  const zoneName = user ? ((await zoneForUser(user.id))?.name ?? user.deliveryZone?.name ?? null) : (zone?.name ?? null);

  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      {/* Guests have no bottom menu, so nothing fixed to the bottom of the
          screen needs to clear one: --mobile-nav-h is zero for them. */}
      <body className="flex min-h-full flex-col" style={user ? undefined : ({ "--mobile-nav-h": "0px" } as React.CSSProperties)}>
        <MotionProvider>
          <SiteSettingsProvider settings={settings}>
          <ZoneProvider initialZoneName={zoneName} autoOpen={!user}>
            <CartProvider initial={cart}>
                {/* The "Freshly selected..." banner is marketing for guests only. */}
                {!user && <AnnouncementBar />}
                <SiteHeader signedIn={Boolean(user)} />
                <OfflineBanner />
                {/* A signed-in visitor always gets the floating dock below,
                    whose real footprint is --dock-clearance (pb-dock zeroes
                    it on desktop, where the dock is a left rail instead of a
                    bottom bar). A guest has no bottom menu to clear. */}
                <main className={user ? "flex-1 pb-dock lg:pl-60" : "flex-1"}>
                  {children}
                </main>
                {/* Signed-in users get every former footer link from Account →
                    Help and info instead; a footer under the bottom nav read like
                    a website, not the app (Basket vs. Cart addendum, Section 6). */}
                {!user && <MarketingFooter />}
                {!user && <CartDrawer />}
                <PrimaryMobileNav signedIn={Boolean(user)} />
                {/* Members already have Kachi in the app (her tab, "Get ideas",
                    the planners); the floating one is for visitors. */}
                {!user && <KachiBubble />}
                {/* Kachi's offer to install Basket as an app, and app notifications. */}
                {user && <AppSetup />}
            </CartProvider>
          </ZoneProvider>
          </SiteSettingsProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
