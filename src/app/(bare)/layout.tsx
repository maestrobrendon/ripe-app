import { SiteSettingsProvider } from "@/components/site-settings-provider";
import { getSiteSettings } from "@/lib/site-settings";
import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontVariables } from "@/brand/fonts";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { MotionProvider } from "@/components/motion-provider";
import { KachiBubble } from "@/components/kachi/kachi-bubble";
import { Analytics } from "@vercel/analytics/next";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Shop fruits and vegetables sourced locally from trusted farmers, delivered across Lagos. Subscribe for member pricing and a standing weekly basket.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

/**
 * Root layout for the pages that draw their own navigation and footer: the
 * homepage, the /home-next draft, sign-up and its welcome screen. Everything
 * else lives in (site), whose root layout carries the shop chrome and the
 * cart, zone and destination providers.
 *
 * Two root layouts rather than one that switches on a request header: Next
 * keeps the root layout across client-side navigations, so a header-switched
 * layout stayed "bare" after a link from the homepage, and the next page
 * rendered with no CartProvider and crashed. Crossing between two root
 * layouts is always a full page load, so each page gets the right shell.
 */
export default async function BareRootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    // hn-page lets sticky sections work (see home-next.css); the pre-paint
    // script adds hn-js to <html>, hence suppressHydrationWarning.
    <html lang="en" className={`${fontVariables} hn-page antialiased`} suppressHydrationWarning>
      <body>
        <MotionProvider>
          <SiteSettingsProvider settings={settings}>
            {children}
          {/* The homepage is for visitors (members are sent to /basket), and
              sign-up hides the bubble itself, so this one is always a guest's. */}
            <KachiBubble />
          </SiteSettingsProvider>
        </MotionProvider>
        {/* Vercel Web Analytics: page views only, no cookies. Never on the admin host. */}
        <Analytics />
        {/* PostHog: the homepage and sign-up are for visitors, so no account is attached here. */}
        <AnalyticsProvider user={null} />
      </body>
    </html>
  );
}
