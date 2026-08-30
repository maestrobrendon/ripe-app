import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { GOALS } from "@/lib/assistant";
import { GOAL_LABEL } from "@/lib/format";
import { toAddable } from "@/lib/product";
import { AssistantPanel } from "./assistant-panel";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; ingredient?: string }>;
}) {
  const { goal, ingredient } = await searchParams;

  const [user, allProducts] = await Promise.all([getCurrentUser(), prisma.product.findMany()]);
  const bySlug = new Map(allProducts.map((p) => [p.slug, p]));
  const byId = new Map(allProducts.map((p) => [p.id, p]));

  const ingredientProduct = ingredient ? bySlug.get(ingredient) : null;

  const recipes = await prisma.recipe.findMany({
    where: {
      ...(goal ? { goalTags: { has: goal } } : {}),
      ...(ingredientProduct ? { ingredientProductIds: { has: ingredientProduct.id } } : {}),
    },
    orderBy: { title: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Recipes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Browse the library, or ask the trained assistant what to make with what is in your cart. It gives
        food ideas, not medical advice.
      </p>

      <div className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Ask the assistant</h2>
        <AssistantPanel
          products={allProducts.map(toAddable)}
          context={{
            favorites: (user?.preferences?.favoriteProductIds ?? [])
              .map((id) => byId.get(id)?.slug)
              .filter((s): s is string => Boolean(s)),
            dietaryNotes: user?.preferences?.dietaryNotes ?? undefined,
            householdSize: user?.preferences?.householdSize ?? undefined,
          }}
          signedIn={Boolean(user)}
        />
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/recipes"
            className={`rounded-full px-4 py-1.5 text-sm ${!goal && !ingredient ? "bg-ripe-green text-white" : "border border-border"}`}
          >
            All recipes
          </Link>
          {GOALS.map((g) => (
            <Link
              key={g.slug}
              href={`/recipes?goal=${g.slug}`}
              className={`rounded-full px-4 py-1.5 text-sm ${goal === g.slug ? "bg-ripe-green text-white" : "border border-border"}`}
            >
              {GOAL_LABEL[g.slug] ?? g.label}
            </Link>
          ))}
        </div>

        {ingredientProduct && (
          <p className="mt-4 text-sm text-muted">
            Filtered to recipes using {ingredientProduct.name}.{" "}
            <Link href="/recipes" className="text-ripe-green underline">Clear</Link>
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {recipes.length === 0 ? (
            <p className="text-sm text-muted">No recipes match that filter yet.</p>
          ) : (
            recipes.map((r) => (
              <Link
                key={r.id}
                href={`/recipes/${r.slug}`}
                className="rounded-2xl border border-border bg-surface p-4 hover:shadow-sm"
              >
                <p className="font-medium">{r.title}</p>
                <p className="mt-1 text-sm text-muted">{r.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.ingredientProductIds.slice(0, 5).map((id) => {
                    const p = byId.get(id);
                    if (!p) return null;
                    return (
                      <span key={id} className="rounded-full bg-ripe-green-light px-2 py-0.5 text-xs">
                        {p.imageEmoji} {p.name}
                      </span>
                    );
                  })}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
