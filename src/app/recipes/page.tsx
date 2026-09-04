import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { GOALS } from "@/lib/assistant";
import { GOAL_LABEL } from "@/lib/format";
import { ProducePlanner } from "./produce-planner";

const SERVINGS_BY_HOUSEHOLD: Record<string, number> = {
  myself: 1,
  partner: 2,
  "family-kids": 4,
  housemates: 3,
  mixed: 3,
};

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

  const prefs = user?.preferences;
  const defaultServings = prefs?.householdType
    ? SERVINGS_BY_HOUSEHOLD[prefs.householdType] ?? 3
    : 3;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Recipes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Use the Produce Planner to turn a goal or an ingredient into fruit-and-vegetable ideas for the
        week, or browse the library below. Food ideas, not medical advice.
      </p>

      <div className="mt-8">
        <ProducePlanner defaultServings={defaultServings} />
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold">Recipe library</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
