"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useCart } from "@/components/cart-provider";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { addRecipeMissing } from "./actions";

export type CookRecipe = {
  slug: string;
  title: string;
  image: string;
  minutes: number;
  /** Ingredients already in the order. */
  have: number;
  total: number;
  /** Ingredients we can bring that the order doesn't have, and what they cost. */
  need: number;
  needCost: number;
};

/** Recipes the order is close to, and one tap to add what each still needs. */
export function CookThisWeek({ deliveryId, recipes, fromOrder }: { deliveryId: string; recipes: CookRecipe[]; fromOrder: boolean }) {
  return (
    <section className="mt-8" aria-labelledby="cook">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="cook" className="text-lg font-semibold">
          Cook this week
        </h2>
        <Link href="/recipes" className="text-sm font-semibold underline underline-offset-2">
          All recipes
        </Link>
      </div>
      <p className="text-sm text-muted">{fromOrder ? "Recipes that use what's already in your order." : "Recipes picked for what you told us you're after."}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <RecipeRow key={r.slug} deliveryId={deliveryId} recipe={r} />
        ))}
      </div>
    </section>
  );
}

function RecipeRow({ deliveryId, recipe: r }: { deliveryId: string; recipe: CookRecipe }) {
  const cart = useCart();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);

  const add = () =>
    start(async () => {
      const res = await addRecipeMissing(deliveryId, r.slug);
      if (!res.ok) return cart.announce(res.error, "error");
      setAdded(true);
      cart.announce(`Added ${res.added ?? r.need} for ${r.title}`);
    });

  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
      <Link href={`/recipes/${r.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-soft-mist">
        <Image src={r.image} alt="" fill sizes="80px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/recipes/${r.slug}`} className="line-clamp-2 font-medium leading-snug hover:underline">
          {r.title}
        </Link>
        <p className="mt-0.5 text-xs text-muted">
          {r.minutes ? `${r.minutes} min · ` : ""}
          {r.have} of {r.total} in your order
        </p>
        <div className="mt-auto pt-2">
          {r.need > 0 && !added ? (
            <button type="button" onClick={add} disabled={pending} className="rounded-full bg-carbon px-3 py-1.5 text-xs font-semibold text-paper-white disabled:opacity-60">
              {pending ? "Adding…" : `Add the ${r.need} you don't have · ${formatNaira(r.needCost)}`}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold">
              <Icon name="checkPlain" size={13} weight="bold" />
              Everything we sell for it is in
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
