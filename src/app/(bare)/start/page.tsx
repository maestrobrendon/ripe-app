import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cleanReferralCode } from "@/lib/referrals";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStarterCandidates } from "@/lib/starter-basket";
import { FRESH_CUTS_TAG } from "@/lib/product";
import { ZONE_COOKIE } from "@/lib/zone";
import { MENU_GOALS, type MenuGoal } from "../home-menu/recipes";
import { getGuestMenu } from "@/lib/menu";
import { getSiteSettings } from "@/lib/site-settings";
import { readCart } from "@/lib/cart";
import { quantityLabel } from "@/lib/delivery-labels";
import { MenuProvider } from "@/components/menu-provider";
import { StartFlow } from "./start-flow";

// Sign-up is a bare page (see src/proxy.ts) in the homepage's own look.
import "../home-menu/home-menu.css";

export const metadata = { title: "Get started. Basket" };

export default async function StartPage({ searchParams }: { searchParams: Promise<{ next?: string; goal?: string; recipe?: string; ref?: string; from?: string }> }) {
  const { next, goal, recipe, ref, from } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const user = await getCurrentUser();
  if (user) redirect(safeNext ?? "/basket");

  const [candidates, freshCuts, zones, store, menu, settings, guestCart] = await Promise.all([
    getStarterCandidates(),
    prisma.product.findMany({ where: { tags: { has: FRESH_CUTS_TAG } }, select: { slug: true } }),
    prisma.deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, area: true, isServed: true, deliveryDays: true, cutoffHour: true },
    }),
    cookies(),
    getGuestMenu(),
    getSiteSettings(),
    readCart(),
  ]);
  // Sign-up is built around their cart only when they chose "Create my account" at checkout
  // (?from=checkout). Every other way in is the usual onboarding; anything already in a
  // cart still joins their first basket when the account is made.
  const lines = guestCart.items.filter((l) => !l.soldOut);
  const cart = from === "checkout" && lines.length
    ? {
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          amount: quantityLabel(l.quantity, l.unit),
          lineTotal: l.standardPrice * l.quantity,
          publicId: l.cloudinaryPublicId,
          emoji: l.imageEmoji,
        })),
        subtotal: lines.reduce((s, l) => s + l.standardPrice * l.quantity, 0),
      }
    : null;
  // Fresh Cuts is archived, so pre-cut items never land in a first basket.
  const cut = new Set(freshCuts.map((p) => p.slug));
  const initialGoal = MENU_GOALS.some((g) => g.id === goal) ? (goal as MenuGoal) : null;

  return (
    <MenuProvider menu={menu}>
      <StartFlow
        candidates={candidates.filter((c) => !cut.has(c.slug))}
        zones={zones}
        initialZone={store.get(ZONE_COOKIE)?.value ?? null}
        initialGoal={initialGoal}
        initialRecipe={menu.some((r) => r.slug === recipe) ? recipe! : null}
        freeDeliveryThreshold={settings.delivery.freeThreshold}
        next={safeNext}
        referralCode={cleanReferralCode(ref) || null}
        cart={cart}
      />
    </MenuProvider>
  );
}
