"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useCart } from "@/components/cart-provider";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { SaveRecipeButton } from "@/app/(site)/recipes/save-recipe-button";
import { haptic } from "@/lib/haptics";
import { addRecipeMissing } from "./actions";

export type CookRecipe = {
  /** The Recipe row, for saving. */
  id: string | null;
  slug: string;
  title: string;
  image: string;
  minutes: number;
  /** Ingredients already in the basket. */
  have: number;
  total: number;
  /** Ingredients we can bring that the order doesn't have, and what they cost. */
  need: number;
  needCost: number;
};

/** Recipes the basket is close to, and one tap to add what each still needs. */
export function CookThisWeek({
  deliveryId,
  recipes,
  fromOrder,
  savedIds,
  hasSaved,
  title = "Cook this week",
  subtitle,
}: {
  deliveryId: string;
  recipes: CookRecipe[];
  fromOrder: boolean;
  savedIds: string[];
  hasSaved: boolean;
  /** Named for their goal ("Quick this week", "Ways to enjoy it"). */
  title?: string;
  subtitle?: string;
}) {
  const saved = new Set(savedIds);
  return (
    <section data-track-section="basket-cook-this-week" className="mt-10" aria-labelledby="cook">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="cook" className="text-xl font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        <span className="flex items-baseline gap-4">
          {hasSaved && (
            <Link href="/recipes/saved" className="text-sm font-semibold underline underline-offset-2">
              Saved
            </Link>
          )}
          <Link href="/recipes" className="text-sm font-semibold underline underline-offset-2">
            All recipes
          </Link>
        </span>
      </div>
      <p className="text-sm text-muted">{subtitle ?? (fromOrder ? "Recipes that use what's already in your basket." : "Recipes picked for what you told us you're after.")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <RecipeRow key={r.slug} deliveryId={deliveryId} recipe={r} saved={r.id ? saved.has(r.id) : null} />
        ))}
      </div>
    </section>
  );
}

/** One recipe: photo, how close the basket is, and "Add N missing". saved: null hides the heart. */
export function RecipeRow({ deliveryId, recipe: r, saved }: { deliveryId: string; recipe: CookRecipe; saved: boolean | null }) {
  const cart = useCart();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);

  const add = () => {
    haptic("light");
    start(async () => {
      const res = await addRecipeMissing(deliveryId, r.slug);
      if (!res.ok) return cart.announce(res.error, "error");
      setAdded(true);
      cart.announce(`Added ${res.added ?? r.need} for ${r.title}`);
    });
  };

  return (
    <article className="relative flex gap-3.5 rounded-2xl border border-hairline bg-surface p-3">
      {saved !== null && r.id && <SaveRecipeButton recipeId={r.id} initialSaved={saved} signedIn />}
      <Link href={`/recipes/${r.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-soft-mist">
        {r.image ? (
          <Image src={r.image} alt="" fill sizes="96px" className="object-cover transition-transform duration-300 hover:scale-[1.04]" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted">
            <Icon name="recipes" size={24} />
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/recipes/${r.slug}`} className={`line-clamp-2 text-[15px] leading-[1.3] font-semibold tracking-[-0.01em] hover:underline ${saved !== null ? "pr-9" : ""}`}>
          {r.title}
        </Link>
        <p className="mt-1 text-[13px] text-muted">
          {r.minutes ? `${r.minutes} min · ` : ""}
          {r.have} of {r.total} in your basket
        </p>
        <div className="mt-auto pt-2.5">
          {r.need > 0 && !added ? (
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-full bg-carbon pr-3.5 pl-4 text-[13px] font-semibold whitespace-nowrap text-paper-white transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span>{pending ? "Adding…" : `Add ${r.need} missing`}</span>
              <span className="text-paper-white/70">{formatNaira(r.needCost)}</span>
            </button>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 text-[13px] font-semibold">
              <Icon name="checkPlain" size={14} weight="bold" />
              All we sell for it is in
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
