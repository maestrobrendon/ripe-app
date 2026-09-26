"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IdeasResponse } from "@/app/api/basket/assistant/route";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { addRecipeIngredients, applyStarterPicks, setBasketItemQuantity } from "./actions";

const chipCls =
  "w-full rounded-input border border-border bg-sky-wash p-3 text-left text-sm transition hover:bg-lavender disabled:opacity-50";

/**
 * Ideas: reads the member's basket and goal and always has something to say.
 * An empty basket gets a starter set built from onboarding answers; anything
 * else gets a gap to fill, a recipe to cook, or a pairing to add. Shared
 * between the desktop panel and the mobile sheet, so both stay in sync.
 */
export function IdeasPanel({
  signature,
  locked,
  onApplied,
}: {
  /** A fingerprint of the basket's contents; refetches suggestions when it changes. */
  signature?: string;
  locked: boolean;
  onApplied?: () => void;
}) {
  const [data, setData] = useState<IdeasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const first = useRef(true);

  useEffect(() => {
    const delay = first.current ? 0 : 1000; // debounce re-queries after basket changes
    first.current = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/basket/assistant");
        if (res.ok) setData((await res.json()) as IdeasResponse);
      } catch {
        /* keep the last suggestion on a transient failure */
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => clearTimeout(id);
  }, [signature]);

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      onApplied?.();
    });

  if (loading && !data) {
    return <p className="text-sm text-muted">Thinking…</p>;
  }
  if (!data || data.kind === "signed-out") {
    return null;
  }

  if (data.kind === "starter") {
    if (data.picks.length === 0) {
      return (
        <div className="rounded-input border border-dashed border-border p-3 text-sm text-muted">
          Not enough in the shop right now to put together a starter set.{" "}
          <Link href="/shop" className="font-semibold text-carbon underline">
            Browse the shop
          </Link>
          .
        </div>
      );
    }
    const total = data.picks.reduce((sum, p) => sum + p.memberPrice * p.quantity, 0);
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">A starting set based on your goal and household, worth {formatNaira(total)}.</p>
        <ul className="space-y-2">
          {data.picks.map((p) => (
            <li key={p.productId} className="flex items-center gap-2 text-sm">
              <ProductImage
                publicId={p.cloudinaryPublicId}
                alt={p.name}
                emoji={p.imageEmoji}
                className="h-8 w-8 shrink-0"
                rounded="rounded-lg"
                emojiClassName="text-lg"
                sizes="32px"
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-xs text-muted">× {p.quantity}</span>
            </li>
          ))}
        </ul>
        <Button
          disabled={locked || isPending}
          onClick={() =>
            run(() => applyStarterPicks(data.picks.map((p) => ({ productId: p.productId, quantity: p.quantity }))))
          }
          size="sm"
          className="w-full"
        >
          Add these {data.picks.length} items
        </Button>
      </div>
    );
  }

  const { recipe, add, gap } = data;

  return (
    <div className="space-y-3">
      {gap && (
        <button
          disabled={locked || isPending || !gap.fixId}
          onClick={() => gap.fixId && run(() => setBasketItemQuantity(gap.fixId!, 1))}
          className={`${chipCls} border-border bg-ember/12`}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-carbon">Gap</span>
          <p className="font-medium">{gap.message}</p>
          {gap.fixName && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <ProductImage
                publicId={gap.fixCloudinaryPublicId}
                alt={gap.fixName}
                emoji={gap.fixEmoji ?? "🥬"}
                className="h-6 w-6 shrink-0"
                rounded="rounded-lg"
                emojiClassName="text-sm"
                sizes="24px"
              />
              Add {gap.fixName}
            </div>
          )}
        </button>
      )}

      {recipe && (
        <button
          disabled={locked || isPending}
          onClick={() => run(() => addRecipeIngredients(recipe.slug))}
          className={chipCls}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-carbon">Recipe</span>
          <p className="font-medium">Make {recipe.title}</p>
          {recipe.addNames.length > 0 && (
            <p className="text-xs text-muted">Adds {recipe.addNames.join(", ")}</p>
          )}
        </button>
      )}

      {add && (
        <button
          disabled={locked || isPending}
          onClick={() => run(() => setBasketItemQuantity(add.id, 1))}
          className={chipCls}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-carbon">Add</span>
          <div className="mt-1 flex items-center gap-2">
            <ProductImage
              publicId={add.cloudinaryPublicId}
              alt={add.name}
              emoji={add.imageEmoji}
              className="h-8 w-8 shrink-0"
              rounded="rounded-lg"
              emojiClassName="text-lg"
              sizes="32px"
            />
            <p className="font-medium">{add.name}</p>
          </div>
          <p className="mt-1 text-xs text-muted">{add.reason}</p>
        </button>
      )}

      {!gap && !recipe && !add && (
        <div className="rounded-input border border-dashed border-border p-3 text-sm text-muted">
          Your basket already covers the basics.{" "}
          <Link href="/recipes" className="font-semibold text-carbon underline">
            Browse recipes
          </Link>{" "}
          for what to make with it.
        </div>
      )}
    </div>
  );
}
