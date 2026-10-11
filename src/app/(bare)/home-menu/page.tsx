import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStarterCandidates } from "@/lib/starter-basket";
import { FRESH_CUTS_TAG } from "@/lib/product";
import { DELIVERY_DAY_LABEL } from "@/lib/format";
import { HomeMenu } from "./home-menu";
import { MENU_SLUGS } from "./recipes";
import type { MenuData, MenuProduct } from "./types";

/*
 * This is the homepage. src/app/(bare)/page.tsx renders it at "/", and src/proxy.ts
 * sends /home-menu there so the page lives at one address.
 */
import "../home-next/home-next.css";
import "./home-menu.css";

export const metadata: Metadata = {
  title: "Basket. Your week of meals, planned and delivered.",
  description:
    "A weekly plan, recipes worth cooking and the fresh produce to make them, delivered across Lagos on your day.",
};

export default async function HomeMenuPage() {
  const [user, products, candidates, freshCuts, zones, tier] = await Promise.all([
    getCurrentUser(),
    prisma.product.findMany({
      where: { slug: { in: MENU_SLUGS } },
      select: { slug: true, name: true, category: true, imageEmoji: true, cloudinaryPublicId: true },
    }),
    getStarterCandidates(),
    prisma.product.findMany({ where: { tags: { has: FRESH_CUTS_TAG } }, select: { slug: true } }),
    prisma.deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, isServed: true, deliveryDays: true },
    }),
    prisma.subscriptionTier.findFirst({ orderBy: { monthlyFee: "asc" }, select: { monthlyFee: true } }),
  ]);

  const cutSlugs = new Set(freshCuts.map((p) => p.slug));
  const served = zones.filter((z) => z.isServed);
  const dayCounts = new Map<string, number>();
  for (const z of served) for (const d of z.deliveryDays) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
  const commonDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "WEDNESDAY";

  const data: MenuData = {
    signedIn: Boolean(user),
    products: Object.fromEntries(products.map((p): [string, MenuProduct] => [p.slug, p])),
    // Fresh Cuts is archived, so pre-cut items never pad the example basket.
    estimatorCandidates: candidates.filter((c) => !cutSlugs.has(c.slug)),
    zones: served.map((z) => ({ name: z.name, days: z.deliveryDays.map((d) => DELIVERY_DAY_LABEL[d] ?? d) })),
    comingSoon: zones.filter((z) => !z.isServed).map((z) => z.name),
    deliveryDay: DELIVERY_DAY_LABEL[commonDay] ?? "Wednesday",
    memberFee: tier?.monthlyFee ?? null,
  };

  return (
    <>
      {/* Before first paint: hide the hero's intro pieces so the timeline can
          bring them in without a flash. Skipped when motion is reduced. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('hn-js')",
        }}
      />
      <HomeMenu data={data} />
    </>
  );
}
