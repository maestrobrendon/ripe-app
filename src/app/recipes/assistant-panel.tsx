"use client";

import { useMemo, useState } from "react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { formatNaira, GOAL_LABEL } from "@/lib/format";
import {
  GOALS,
  getGoalSuggestions,
  getBasketSuggestions,
  type AssistantContext,
} from "@/lib/assistant";

export function AssistantPanel({
  products,
  context,
  signedIn,
}: {
  products: AddableProduct[];
  context: AssistantContext;
  signedIn: boolean;
}) {
  const cart = useCart();
  const [mode, setMode] = useState<"cart" | string>("cart");
  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const cartSlugs = cart.items.map((i) => i.slug);

  const result = useMemo(() => {
    if (mode === "cart") {
      const plan = getBasketSuggestions(cartSlugs, context);
      return {
        heading:
          cartSlugs.length === 0
            ? "Add a few items to your cart, then ask again."
            : "Based on what is in your cart",
        recipes: [] as { title: string; uses: string[]; note: string }[],
        pairings: plan.pairings,
        addOns: plan.addOns,
      };
    }
    const plan = getGoalSuggestions(mode, context);
    return {
      heading: `For ${(GOAL_LABEL[mode] ?? mode).toLowerCase()}`,
      recipes: plan?.recipes ?? [],
      pairings: [] as { forProduct: string; suggest: string[] }[],
      addOns: plan?.addOns ?? [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cartSlugs.join(","), context]);

  return (
    <div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setMode("cart")}
          className={`rounded-full px-4 py-1.5 text-sm ${mode === "cart" ? "bg-ripe-green text-white" : "border border-border"}`}
        >
          Read my cart
        </button>
        {GOALS.map((g) => (
          <button
            key={g.slug}
            onClick={() => setMode(g.slug)}
            className={`rounded-full px-4 py-1.5 text-sm ${mode === g.slug ? "bg-ripe-green text-white" : "border border-border"}`}
          >
            {GOAL_LABEL[g.slug] ?? g.label}
          </button>
        ))}
      </div>

      {!signedIn && (
        <p className="mt-3 text-xs text-muted">
          Sign in and finish the short onboarding survey to get suggestions shaped around what you actually eat.
        </p>
      )}

      <div className="mt-5 space-y-5">
        <h3 className="text-sm font-medium">{result.heading}</h3>

        {result.recipes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {result.recipes.map((r) => (
              <div key={r.title} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-1 text-xs text-muted">{r.note}</p>
              </div>
            ))}
          </div>
        )}

        {result.pairings.length > 0 && (
          <ul className="space-y-2 text-sm">
            {result.pairings.map((p) => (
              <li key={p.forProduct}>
                <span className="font-medium">{bySlug.get(p.forProduct)?.name ?? p.forProduct}</span> pairs
                well with {p.suggest.map((s) => bySlug.get(s)?.name ?? s).join(", ")}.
              </li>
            ))}
          </ul>
        )}

        {result.addOns.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">You might want to add</p>
            <div className="flex flex-wrap gap-2">
              {result.addOns.map((slug) => {
                const p = bySlug.get(slug);
                if (!p) return null;
                const inCart = cart.items.some((i) => i.productId === p.id);
                return (
                  <button
                    key={slug}
                    disabled={inCart}
                    onClick={() => cart.setQuantity(p, p.minOrderQty)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      inCart
                        ? "border-border text-muted"
                        : "border-ripe-green text-ripe-green hover:bg-ripe-green-light"
                    }`}
                  >
                    <span>{p.imageEmoji}</span>
                    {p.name}
                    <span className="text-muted">{formatNaira(p.standardPrice)}</span>
                    {inCart ? "· in cart" : "· add"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
