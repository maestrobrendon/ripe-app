import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStarterCandidates } from "@/lib/starter-basket";
import { FRESH_CUTS_TAG } from "@/lib/product";
import { DELIVERY_DAY_LABEL } from "@/lib/format";
import { HomeMenu } from "./home-menu";
import { getGuestMenu, getMenuSlugs } from "@/lib/menu";
import { MenuProvider } from "@/components/menu-provider";
import type { MenuData, MenuProduct } from "./types";

/*
 * This is the homepage. src/app/(bare)/page.tsx renders it at "/", and src/proxy.ts
 * sends /home-menu there so the page lives at one address.
 */
import "../home-next/home-next.css";
import "./home-menu.css";

export const metadata: Metadata = {
  title: "BasketNG. Fresh fruit and veg, delivered every week in Lagos.",
  description:
    "Pick your fruit and vegetables and your day, and it keeps coming, with recipes so you actually eat it. Delivered across Lagos. Pay when it arrives.",
};

/**
 * Everything the homepage shows that's the same for every visitor: the menu,
 * its produce, the example basket's candidates, the areas and the cheapest
 * plan. Kept for five minutes, so a visit isn't waiting on seven database
 * round trips; an edit in the admin shows within five minutes.
 */
const homepageCatalogue = unstable_cache(
  async () => {
    const [menu, menuSlugs] = await Promise.all([getGuestMenu(), getMenuSlugs()]);
    const [products, candidates, freshCuts, zones, tier] = await Promise.all([
      prisma.product.findMany({
        where: { slug: { in: menuSlugs } },
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
    return { menu, products, candidates, freshCuts, zones, tier };
  },
  ["homepage-catalogue"],
  { revalidate: 300 },
);

export default async function HomeMenuPage() {
  // Who's visiting is read fresh every time; the catalogue comes from the cache.
  const [user, { menu, products, candidates, freshCuts, zones, tier }] = await Promise.all([getCurrentUser(), homepageCatalogue()]);

  const cutSlugs = new Set(freshCuts.map((p) => p.slug));
  const served = zones.filter((z) => z.isServed);
  const dayCounts = new Map<string, number>();
  for (const z of served) for (const d of z.deliveryDays) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
  const commonDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "FRIDAY";

  const data: MenuData = {
    signedIn: Boolean(user),
    products: Object.fromEntries(products.map((p): [string, MenuProduct] => [p.slug, p])),
    // Fresh Cuts is archived, so pre-cut items never pad the example basket.
    estimatorCandidates: candidates.filter((c) => !cutSlugs.has(c.slug)),
    zones: served.map((z) => ({ name: z.name, days: z.deliveryDays.map((d) => DELIVERY_DAY_LABEL[d] ?? d) })),
    comingSoon: zones.filter((z) => !z.isServed).map((z) => z.name),
    deliveryDay: DELIVERY_DAY_LABEL[commonDay] ?? "Friday",
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
      <MenuProvider menu={menu}>
        <HomeMenu data={data} />
      </MenuProvider>
    </>
  );
}
