"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { PREP_GROUP_LABEL, type PrepGroup } from "@/lib/produce-variety";
import type { ProduceListLine } from "@/lib/produce-list";
import { getProduceList, addProduceListItems } from "./produce-list-actions";

const GOAL_OPTIONS: { slug: string; label: string; emoji: string }[] = [
  { slug: "general-wellness", label: "General wellness", emoji: "🌿" },
  { slug: "weight-management", label: "Weight management", emoji: "⚖️" },
  { slug: "post-workout-recovery", label: "Post-workout recovery", emoji: "💪" },
  { slug: "family-household", label: "Family and household", emoji: "👨‍👩‍👧" },
];

const PREP_GROUPS: PrepGroup[] = ["raw", "cooked", "either"];

/**
 * Two questions, then a list: how many people, and what you want more of.
 * Everything on it is real, in-season catalog produce, grouped by whether
 * you'd eat it raw or cook it.
 */
export function ProduceListTab({
  defaultGoal,
  defaultServings,
  signedIn,
  isSubscriber,
}: {
  defaultGoal: string;
  defaultServings: number;
  signedIn: boolean;
  isSubscriber: boolean;
}) {
  const [people, setPeople] = useState(defaultServings);
  const [goal, setGoal] = useState(defaultGoal);
  const [lines, setLines] = useState<ProduceListLine[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState<"cart" | "basket" | null>(null);

  const makeList = () =>
    startTransition(async () => {
      const result = await getProduceList(goal, people);
      setLines(result);
      setAdded(null);
    });

  const remove = (productId: string) => setLines((l) => l && l.filter((line) => line.productId !== productId));

  const total = lines?.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) ?? 0;

  const addTo = (destination: "cart" | "basket") =>
    startTransition(async () => {
      if (!lines) return;
      await addProduceListItems(
        lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        destination,
      );
      setAdded(destination);
    });

  if (!lines) {
    return (
      <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
        <h3 className="text-heading">Your produce for the week</h3>
        <p className="mt-1 text-muted">Answer two things. We will list the fruit and vegetables to buy.</p>

        <p className="mt-6 text-sm font-semibold">1. How many people?</p>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-soft-mist p-1">
          <button
            onClick={() => setPeople((p) => Math.max(1, p - 1))}
            aria-label="Fewer people"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon name="minus" size={15} />
          </button>
          <span className="w-24 text-center text-sm font-semibold">
            {people} {people === 1 ? "person" : "people"}
          </span>
          <button
            onClick={() => setPeople((p) => Math.min(12, p + 1))}
            aria-label="More people"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon name="plus" size={15} />
          </button>
        </div>

        <p className="mt-6 text-sm font-semibold">2. What do you want more of?</p>
        <p className="-mt-1 text-xs text-muted">We picked this from your profile. Change it if you like.</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.slug}
              onClick={() => setGoal(g.slug)}
              aria-pressed={goal === g.slug}
              className={`flex min-h-23 flex-col gap-1.5 rounded-input border p-3.5 text-left ${
                goal === g.slug ? "border-carbon bg-soft-mist" : "border-border"
              }`}
            >
              <span className="text-2xl" aria-hidden>{g.emoji}</span>
              <span className="text-sm font-semibold leading-snug">{g.label}</span>
            </button>
          ))}
        </div>

        <button
          disabled={isPending}
          onClick={makeList}
          className="tap-target mt-7 w-full rounded-full bg-carbon py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Make my list
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-heading">{GOAL_OPTIONS.find((g) => g.slug === goal)?.label ?? "Your produce list"}</h3>
          <p className="mt-1 text-muted">
            For {people} {people === 1 ? "person" : "people"}, one week.
          </p>
        </div>
        <button onClick={() => setLines(null)} className="text-sm font-semibold text-carbon underline">
          Start over
        </button>
      </div>

      {PREP_GROUPS.map((group) => {
        const rows = lines.filter((l) => l.prep === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{PREP_GROUP_LABEL[group]}</p>
            <div className="mt-2 divide-y divide-border">
              {rows.map((l) => (
                <div key={l.productId} className="flex items-center gap-3 py-2.5">
                  <ProductImage
                    publicId={l.cloudinaryPublicId}
                    alt={l.name}
                    emoji={l.imageEmoji}
                    className="h-11 w-11 shrink-0"
                    rounded="rounded-xl"
                    emojiClassName="text-xl"
                    sizes="44px"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.name}</span>
                    <span className="block text-xs text-muted">{l.quantity} x {l.unit}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">{formatNaira(l.unitPrice * l.quantity)}</span>
                  <button onClick={() => remove(l.productId)} aria-label={`Remove ${l.name}`} className="shrink-0 text-muted hover:text-foreground">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-sm">
          <span className="text-muted">Total</span> <span className="font-semibold">{formatNaira(total)}</span>
        </p>

        {!signedIn ? (
          <Link href="/start" className="tap-target rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white">
            Create an account to add these
          </Link>
        ) : added ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-carbon">
            <Icon name="check" size={16} />
            Added to your {added}.
          </p>
        ) : isSubscriber ? (
          <div className="flex gap-2">
            <button disabled={isPending} onClick={() => addTo("cart")} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
              Add to cart
            </button>
            <button disabled={isPending} onClick={() => addTo("basket")} className="rounded-full bg-carbon px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              Add to basket
            </button>
          </div>
        ) : (
          <button disabled={isPending} onClick={() => addTo("cart")} className="tap-target rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            Get these
          </button>
        )}
      </div>
    </div>
  );
}
