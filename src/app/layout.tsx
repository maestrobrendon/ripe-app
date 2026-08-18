import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { BasketProvider } from "@/components/basket-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BasketDrawer } from "@/components/basket-drawer";

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
  title: "Ripe — Fruits and vegetables, curated for health",
  description:
    "A subscription-and-basket fruit and vegetable delivery service for Lagos, sourced farm-direct from Ogun, Oyo and Ondo state farms.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const basketView = user ? await getStandingBasketView(user.id) : null;

  const initialBasket = {
    items:
      basketView?.basket.items.map((i) => ({
        productId: i.productId,
        slug: i.product.slug,
        name: i.product.name,
        unit: i.product.unit,
        imageEmoji: i.product.imageEmoji,
        memberPrice: i.product.memberPrice,
        marketPrice: i.product.marketPrice,
        quantity: i.quantity,
      })) ?? [],
    memberSubtotal: basketView?.memberSubtotal ?? 0,
    marketSubtotal: basketView?.marketSubtotal ?? 0,
    deliveryDay: basketView?.basket.deliveryDay ?? null,
  };

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BasketProvider initial={initialBasket} isSignedIn={Boolean(user)}>
          <SiteHeader userName={user?.name ?? null} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <BasketDrawer />
        </BasketProvider>
      </body>
    </html>
  );
}
