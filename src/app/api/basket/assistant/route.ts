import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { resolveStarterBasket } from "@/lib/starter-basket";
import { buildHubSuggestion } from "@/lib/basket-assistant";

export type IdeasResponse =
  | { kind: "signed-out" }
  | { kind: "starter"; picks: Awaited<ReturnType<typeof resolveStarterBasket>> }
  | ({ kind: "suggestions" } & ReturnType<typeof buildHubSuggestion>);

/**
 * Ideas is available to every signed-in member, not just subscribers: the
 * empty-basket starter set in particular is most useful to someone who has
 * not subscribed yet.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json<IdeasResponse>({ kind: "signed-out" });

  const view = await getStandingBasketView(user.id);
  const basketItems = view?.basket.items ?? [];

  if (basketItems.length === 0) {
    const picks = await resolveStarterBasket(user.id);
    return NextResponse.json<IdeasResponse>({ kind: "starter", picks });
  }

  const [products, recipes] = await Promise.all([prisma.product.findMany(), prisma.recipe.findMany()]);

  const byId = new Map(products.map((p) => [p.id, p]));
  const favoriteSlugs = (user.preferences?.favoriteProductIds ?? [])
    .map((id) => byId.get(id)?.slug)
    .filter((s): s is string => Boolean(s));

  const basket = basketItems.map((i) => ({
    slug: i.product.slug,
    name: i.product.name,
    category: i.product.category,
    inSeason: i.product.inSeason,
  }));

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

  return NextResponse.json<IdeasResponse>({ kind: "suggestions", ...suggestion });
}
