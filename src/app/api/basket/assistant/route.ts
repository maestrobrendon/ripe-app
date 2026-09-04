import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { buildHubSuggestion } from "@/lib/basket-assistant";

const EMPTY = { recipe: null, add: null, gap: null };

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.subscriptionTierId) return NextResponse.json(EMPTY);

  const [view, products, recipes] = await Promise.all([
    getStandingBasketView(user.id),
    prisma.product.findMany(),
    prisma.recipe.findMany(),
  ]);

  const byId = new Map(products.map((p) => [p.id, p]));
  const favoriteSlugs = (user.preferences?.favoriteProductIds ?? [])
    .map((id) => byId.get(id)?.slug)
    .filter((s): s is string => Boolean(s));

  const basket =
    view?.basket.items.map((i) => ({
      slug: i.product.slug,
      name: i.product.name,
      category: i.product.category,
      inSeason: i.product.inSeason,
    })) ?? [];

  const suggestion = buildHubSuggestion({
    basket,
    goal: user.preferences?.primaryGoal ?? null,
    context: {
      favorites: favoriteSlugs,
      dietaryNotes: user.preferences?.dietaryNotes ?? undefined,
      householdType: user.preferences?.householdType ?? undefined,
      cookTimeAvailable: user.preferences?.cookTimeAvailable ?? undefined,
    },
    products,
    recipes,
  });

  return NextResponse.json(suggestion);
}
