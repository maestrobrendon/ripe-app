"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HubSuggestion } from "@/lib/basket-assistant";
import { addRecipeIngredients, setBasketItemQuantity } from "./actions";

export function AssistantRail({
  signature,
  locked,
}: {
  signature: string;
  locked: boolean;
}) {
  const [data, setData] = useState<HubSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const first = useRef(true);

  useEffect(() => {
    const delay = first.current ? 0 : 1000; // debounce re-queries after basket changes
    first.current = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch("/api/basket/assistant");
        if (res.ok) setData((await res.json()) as HubSuggestion);
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
    });

  const chipCls =
    "w-full rounded-xl border border-ripe-green/40 bg-ripe-green-light/40 p-3 text-left text-sm transition hover:border-ripe-green disabled:opacity-50";

  return (
    <aside className="rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Trained assistant</h2>
        {loading && <span className="text-xs text-muted">thinking…</span>}
      </div>
      <p className="mt-1 text-xs text-muted">
        Reads your basket and goal. Tap a chip to apply it, no navigation.
      </p>

      <div className="mt-4 space-y-3">
        {data?.recipe && (
          <button
            disabled={locked || isPending}
            onClick={() => run(() => addRecipeIngredients(data.recipe!.slug))}
            className={chipCls}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-ripe-green">Recipe</span>
            <p className="font-medium">Make {data.recipe.title}</p>
            {data.recipe.addNames.length > 0 && (
              <p className="text-xs text-muted">Adds {data.recipe.addNames.join(", ")}</p>
            )}
          </button>
        )}

        {data?.add && (
          <button
            disabled={locked || isPending}
            onClick={() => run(() => setBasketItemQuantity(data.add!.id, 1))}
            className={chipCls}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-ripe-green">Add</span>
            <p className="font-medium">
              {data.add.imageEmoji} {data.add.name}
            </p>
            <p className="text-xs text-muted">{data.add.reason}</p>
          </button>
        )}

        {data?.gap && (
          <button
            disabled={locked || isPending || !data.gap.fixId}
            onClick={() => data.gap?.fixId && run(() => setBasketItemQuantity(data.gap!.fixId!, 1))}
            className={`${chipCls} border-ripe-terracotta/40 bg-ripe-terracotta-light/40`}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-ripe-terracotta-dark">
              Gap
            </span>
            <p className="font-medium">{data.gap.message}</p>
            {data.gap.fixName && (
              <p className="text-xs text-muted">
                {data.gap.fixEmoji} Add {data.gap.fixName}
              </p>
            )}
          </button>
        )}

        {!loading && data && !data.recipe && !data.add && !data.gap && (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted">
            Your basket looks well balanced. Nothing to suggest right now.
          </p>
        )}
      </div>
    </aside>
  );
}
