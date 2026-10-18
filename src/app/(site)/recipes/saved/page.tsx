import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOrCreateActiveDelivery, isMember } from "@/lib/order-container";
import { toMenuRecipe } from "@/lib/menu";
import { buyableFor, fitRecipe } from "@/lib/recipe-fit";
import { basketName } from "@/lib/delivery-labels";
import { BackButton } from "@/components/ui/back-button";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RecipeRow } from "../../basket/cook-this-week";

export const metadata = { title: "Saved recipes" };

/**
 * The recipes a customer has kept, newest first, each with how close their
 * basket is to it and one tap to add what's missing. The heart takes a
 * recipe off the list.
 */
export default async function SavedRecipesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/recipes/saved");

  const [rows, basket] = await Promise.all([
    prisma.savedRecipe.findMany({ where: { userId: user.id, recipe: { status: "PUBLISHED" } }, orderBy: { savedAt: "desc" }, include: { recipe: true } }),
    getOrCreateActiveDelivery(user),
  ]);
  const recipes = rows.map((s) => toMenuRecipe(s.recipe));
  const [buyable, items] = await Promise.all([
    buyableFor(recipes),
    prisma.basketItem.findMany({ where: { basketId: basket.id }, select: { product: { select: { slug: true } } } }),
  ]);
  const inBasket = new Set(items.map((i) => i.product.slug));
  const member = isMember(user);
  const cards = recipes.map((r) => fitRecipe(r, inBasket, buyable, member));

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:pb-12">
      <BackButton fallback="/recipes" label="Recipes" />
      <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">Saved recipes</h1>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-hairline px-6 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-soft-mist">
            <Icon name="favourite" size={22} />
          </span>
          <p className="mt-4 text-lg font-semibold">Nothing saved yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Tap the heart on any recipe and it stays here, ready for the weeks you want to cook it.</p>
          <LinkButton href="/recipes" size="sm" className="mt-5">
            Browse recipes
          </LinkButton>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-muted">
            {cards.length} {cards.length === 1 ? "recipe" : "recipes"}, matched against {basketName(basket)}.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {cards.map((r) => (
              <RecipeRow key={r.slug} deliveryId={basket.id} recipe={r} saved />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
