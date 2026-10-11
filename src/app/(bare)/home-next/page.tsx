import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { buildStarterPicks, getHeroBasketCandidates, getStarterCandidates } from "@/lib/starter-basket";
import { DELIVERY_DAY_LABEL } from "@/lib/format";
import { FREE_DELIVERY_THRESHOLD, BASE_DELIVERY_FEE } from "@/lib/pricing";
import { HomeNext } from "./home-next";
import type { HomeData, ShowcaseGoal } from "./types";
import "./home-next.css";

export const metadata: Metadata = {
  title: "Basket. Fresh produce, on your day, every week.",
  description:
    "A basket of fresh fruit and vegetables that shows up on your day, every week. Farm-direct, across Lagos.",
  // A preview of the next homepage. Kept out of search until it replaces the live one.
  robots: { index: false, follow: false },
};

/**
 * Who each showcase basket is sized for. The goal slugs and their produce
 * come from the same starter logic the sign-up flow uses, so the tiles and
 * prices on the page are exactly what the customer would get.
 */
const SHOWCASE: Omit<ShowcaseGoal, "picks" | "standardTotal" | "memberTotal">[] = [
  {
    slug: "post-workout-recovery",
    tab: "Training",
    title: "Training week",
    body: "Quick energy before, something to rebuild with after. Sized for one person training most days.",
    adults: 1,
    kids: 0,
  },
  {
    slug: "family-household",
    tab: "Family",
    title: "The family table",
    body: "Fruit the children will actually eat, and the base for the week's stew. Sized for four.",
    adults: 2,
    kids: 2,
  },
  {
    slug: "general-wellness",
    tab: "Everyday",
    title: "Everyday greens",
    body: "A steady spread through the week, so there is always something fresh in the fridge. For two.",
    adults: 2,
    kids: 0,
  },
  {
    slug: "weight-management",
    tab: "Lighter",
    title: "A lighter week",
    body: "Crunchy, filling and easy to eat raw. Lighter meals without it feeling like a diet.",
    adults: 1,
    kids: 0,
  },
];

export default async function HomeNextPage() {
  const [user, candidates, heroCandidates, farm, zones, tier] = await Promise.all([
    getCurrentUser(),
    getStarterCandidates(),
    getHeroBasketCandidates(),
    prisma.product.findMany({
      where: { category: { in: ["FRUIT", "VEGETABLE", "SEASONAL"] } },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: 22,
      select: {
        id: true,
        name: true,
        category: true,
        imageEmoji: true,
        cloudinaryPublicId: true,
        standardPrice: true,
        unit: true,
        inSeason: true,
      },
    }),
    prisma.deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, isServed: true, deliveryDays: true },
    }),
    prisma.subscriptionTier.findFirst({ orderBy: { monthlyFee: "asc" }, select: { name: true, monthlyFee: true } }),
  ]);

  const served = zones.filter((z) => z.isServed);

  // The day most served zones share. It is what the page's example basket
  // says it "comes every", so the story matches what a new customer can pick.
  const dayCounts = new Map<string, number>();
  for (const z of served) for (const d of z.deliveryDays) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
  const commonDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "WEDNESDAY";

  const goals: ShowcaseGoal[] = SHOWCASE.map((g) => {
    const picks = buildStarterPicks({ goalSlug: g.slug, producePreferences: [], adults: g.adults, kids: g.kids }, candidates);
    return {
      ...g,
      picks,
      standardTotal: picks.reduce((s, p) => s + p.standardPrice * p.quantity, 0),
      memberTotal: picks.reduce((s, p) => s + p.memberPrice * p.quantity, 0),
    };
  });

  const data: HomeData = {
    signedIn: Boolean(user),
    firstName: user?.name.split(" ")[0] ?? null,
    goals,
    estimatorCandidates: heroCandidates,
    farm,
    zones: served.map((z) => ({ name: z.name, days: z.deliveryDays.map((d) => DELIVERY_DAY_LABEL[d] ?? d) })),
    comingSoon: zones.filter((z) => !z.isServed).map((z) => z.name),
    deliveryDay: DELIVERY_DAY_LABEL[commonDay] ?? "Wednesday",
    memberFee: tier?.monthlyFee ?? null,
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    deliveryFee: BASE_DELIVERY_FEE,
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
      <HomeNext data={data} />
    </>
  );
}
