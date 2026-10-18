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
import { MenuProvider } from "@/components/menu-provider";
import { StartFlow } from "./start-flow";

// Sign-up is a bare page (see src/proxy.ts) in the homepage's own look.
import "../home-menu/home-menu.css";

export const metadata = { title: "Get started. Basket" };

export default async function StartPage({ searchParams }: { searchParams: Promise<{ next?: string; goal?: string; recipe?: string; ref?: string }> }) {
  const { next, goal, recipe, ref } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const user = await getCurrentUser();
  if (user) redirect(safeNext ?? "/basket");

  const [candidates, freshCuts, zones, store, menu, settings] = await Promise.all([
    getStarterCandidates(),
    prisma.product.findMany({ where: { tags: { has: FRESH_CUTS_TAG } }, select: { slug: true } }),
    prisma.deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, area: true, isServed: true, deliveryDays: true, cutoffHour: true },
    }),
    cookies(),
    getGuestMenu(),
    getSiteSettings(),
  ]);
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
      />
    </MenuProvider>
  );
}
