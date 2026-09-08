import { prisma } from "@/lib/prisma";
import { buildStarterPicks, type StarterCandidate, type StarterPick } from "@/lib/starter-basket-core";

export * from "@/lib/starter-basket-core";

export async function getStarterCandidates(): Promise<StarterCandidate[]> {
  return prisma.product.findMany({
    where: { category: { in: ["FRUIT", "VEGETABLE", "SEASONAL", "BOX_BUNDLE"] } },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      imageEmoji: true,
      cloudinaryPublicId: true,
      minOrderQty: true,
      stepQty: true,
      memberPrice: true,
      standardPrice: true,
      featured: true,
      inSeason: true,
    },
    orderBy: { name: "asc" },
  });
}

/** Starter picks for a saved user, from their preferences. */
export async function resolveStarterBasket(userId: string): Promise<StarterPick[]> {
  const [user, prefs, candidates] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { householdAdults: true, householdKids: true } }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { primaryGoal: true, producePreferences: true },
    }),
    getStarterCandidates(),
  ]);

  return buildStarterPicks(
    {
      goalSlug: prefs?.primaryGoal ?? null,
      producePreferences: prefs?.producePreferences ?? [],
      adults: user?.householdAdults ?? 1,
      kids: user?.householdKids ?? 0,
    },
    candidates,
  );
}
