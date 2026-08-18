import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/format";
import { GOALS, getGoalSuggestions, getBasketSuggestions } from "@/lib/assistant";
import { AddSuggestionButton } from "./add-suggestion-button";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/subscribe");

  const { goal: goalSlug } = await searchParams;
  const view = await getStandingBasketView(user.id);
  const basketSlugs = view?.basket.items.map((i) => i.product.slug) ?? [];

  const allProducts = await prisma.product.findMany();
  const bySlug = new Map(allProducts.map((p) => [p.slug, p]));

  const goalPlan = goalSlug ? getGoalSuggestions(goalSlug) : null;
  const basketPlan = !goalSlug && basketSlugs.length > 0 ? getBasketSuggestions(basketSlugs) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">The trained assistant</h1>
      <p className="mt-3 text-sm text-muted">
        Pick a goal, or let it read what&rsquo;s already in your basket. It&rsquo;ll suggest what people usually
        make, and one or two things you might want to add — not medical advice, just practical ideas.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/assistant"
          className={`rounded-full px-4 py-1.5 text-sm ${
            !goalSlug ? "bg-ripe-green text-white" : "border border-border hover:bg-ripe-green-light"
          }`}
        >
          Read my basket
        </Link>
        {GOALS.map((g) => (
          <Link
            key={g.slug}
            href={`/assistant?goal=${g.slug}`}
            className={`rounded-full px-4 py-1.5 text-sm ${
              goalSlug === g.slug ? "bg-ripe-green text-white" : "border border-border hover:bg-ripe-green-light"
            }`}
          >
            {g.label}
          </Link>
        ))}
      </div>

      <div className="mt-10 space-y-6">
        {goalSlug && goalPlan && (
          <>
            <h2 className="text-lg font-medium">
              For {GOALS.find((g) => g.slug === goalSlug)?.label.toLowerCase()}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {goalPlan.recipes.map((recipe) => (
                <div key={recipe.title} className="rounded-2xl border border-border bg-surface p-4">
                  <p className="font-medium">{recipe.title}</p>
                  <p className="mt-1 text-sm text-muted">{recipe.note}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipe.uses.map((slug) => {
                      const p = bySlug.get(slug);
                      if (!p) return null;
                      return (
                        <span key={slug} className="rounded-full bg-ripe-green-light px-2 py-1 text-xs">
                          {p.imageEmoji} {p.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-medium">You might want to add</h2>
              <div className="flex flex-wrap gap-3">
                {goalPlan.addOns.map((slug) => {
                  const p = bySlug.get(slug);
                  if (!p) return null;
                  return (
                    <div key={slug} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                      <span className="text-2xl">{p.imageEmoji}</span>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted">{formatNaira(p.memberPrice)}</p>
                      </div>
                      <AddSuggestionButton
                        product={{ id: p.id, slug: p.slug, name: p.name, unit: p.unit, imageEmoji: p.imageEmoji, memberPrice: p.memberPrice, marketPrice: p.marketPrice }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!goalSlug && basketPlan && basketPlan.pairings.length > 0 && (
          <>
            <h2 className="text-lg font-medium">Based on what&rsquo;s already in your basket</h2>
            <div className="space-y-3">
              {basketPlan.pairings.map((pair) => {
                const base = bySlug.get(pair.forProduct);
                if (!base) return null;
                return (
                  <div key={pair.forProduct} className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-sm">
                      <span className="font-medium">{base.imageEmoji} {base.name}</span> pairs well with{" "}
                      {pair.suggest.map((s) => bySlug.get(s)?.name).filter(Boolean).join(", ")}.
                    </p>
                  </div>
                );
              })}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-medium">You might want to add</h2>
              <div className="flex flex-wrap gap-3">
                {basketPlan.addOns.map((slug) => {
                  const p = bySlug.get(slug);
                  if (!p) return null;
                  return (
                    <div key={slug} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                      <span className="text-2xl">{p.imageEmoji}</span>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted">{formatNaira(p.memberPrice)}</p>
                      </div>
                      <AddSuggestionButton
                        product={{ id: p.id, slug: p.slug, name: p.name, unit: p.unit, imageEmoji: p.imageEmoji, memberPrice: p.memberPrice, marketPrice: p.marketPrice }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!goalSlug && basketSlugs.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Your basket is empty, so there&rsquo;s nothing to read yet. Pick a goal above, or{" "}
            <Link href="/shop" className="text-ripe-green underline">add a few items</Link> first.
          </p>
        )}

        {!goalSlug && basketSlugs.length > 0 && basketPlan?.pairings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Your basket looks well paired already. Pick a goal above for more ideas.
          </p>
        )}
      </div>
    </div>
  );
}
