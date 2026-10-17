"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/format";
import { Check, ShareMeter } from "@/app/(bare)/home-menu/parts/shared";
import { sendRecipeBySlug } from "../meal-plan-actions";

export type CtaProps = {
  slug: string;
  /** Where sign-up should start: the recipe's goal and, for menu recipes, the recipe itself. */
  startHref: string;
  signedIn: boolean;
  isSubscriber: boolean;
  fromBasket: number;
  total: number;
  /** Ingredients still to get (all of them, unless a subscriber already has some). */
  toGet: number;
  /** What those cost at one minimum order each. */
  cost: number;
};

const arrow = (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);

/**
 * The one thing every recipe page asks for. A guest starts sign-up with this
 * recipe already picked; an account gets the ingredients added in one tap,
 * to the basket for a subscriber (only what's missing) or the cart otherwise.
 * Drawn twice: a card beside the recipe on wide screens, a bar along the
 * bottom on phones.
 */
export function RecipeCta(props: CtaProps) {
  const { signedIn, isSubscriber, fromBasket, total, toGet, cost, startHref, slug } = props;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ added: number; to: "basket" | "cart" } | null>(null);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  const add = () =>
    startTransition(async () => {
      setFailed(false);
      try {
        setResult(await sendRecipeBySlug(slug));
        router.refresh();
      } catch {
        setFailed(true);
      }
    });

  const nothingToGet = signedIn && toGet === 0;
  const label = !signedIn ? "Start with this recipe" : isSubscriber ? `Add ${toGet} to my basket` : "Add ingredients to cart";
  const destination = result?.to === "basket" ? "/basket" : "/cart";

  const action = (size: "md" | "sm") => {
    const cls = `inline-flex w-full items-center justify-center gap-2 rounded-full bg-carbon font-semibold text-paper-white transition hover:bg-carbon/85 disabled:opacity-60 ${size === "md" ? "h-13 text-[15px]" : "h-12 text-[14px]"}`;
    if (result)
      return (
        <Link href={destination} className={cls}>
          {result.added > 0 ? `Added ${result.added}. View ${result.to}` : `Already in your ${result.to}. View it`} {arrow}
        </Link>
      );
    if (nothingToGet)
      return (
        <p className={`${cls} bg-mint-pop! text-carbon!`}>
          <Check className="h-4 w-4" /> You have everything
        </p>
      );
    if (!signedIn)
      return (
        <Link href={startHref} className={cls}>
          {label} {arrow}
        </Link>
      );
    return (
      <button type="button" onClick={add} disabled={isPending} className={cls}>
        {isPending ? "Adding…" : label}
      </button>
    );
  };

  return (
    <>
      <aside className="hidden lg:block" aria-label="Get the ingredients">
        <div className="rounded-[28px] bg-[var(--hm-tint)] p-6">
          <p className="text-[15px] font-semibold">{signedIn ? "Get the ingredients" : "Cook this next week"}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--hm-ink-2)]">
            {signedIn
              ? "We add the fresh produce for you. The rest is on the list below."
              : "Pick it when you sign up and the fresh produce comes in your first basket, on your day."}
          </p>
          <ShareMeter have={fromBasket} total={total} className="mt-5" animate={false} />
          <p className="mt-2 text-[13px] text-[var(--hm-ink-2)]">
            <b className="font-semibold text-carbon">
              {fromBasket} of {total}
            </b>{" "}
            ingredients come in your basket
          </p>
          {toGet > 0 && !result && (
            <p className="mt-5 flex items-baseline justify-between border-t border-[var(--hm-line)] pt-4 text-[14px]">
              <span className="text-[var(--hm-ink-2)]">{signedIn && isSubscriber ? `The ${toGet} you're missing` : "Produce from"}</span>
              <b className="text-[18px] font-semibold tabular-nums">{formatNaira(cost)}</b>
            </p>
          )}
          <div className="mt-5">{action("md")}</div>
          {failed && <p className="mt-3 text-[13px] text-ember">That didn&apos;t go through. Try again in a moment.</p>}
          {!signedIn && (
            <ul className="mt-5 space-y-2 text-[13px] text-[var(--hm-ink-2)]">
              {["Change your basket until the night before.", "Skip a week and nothing is charged.", "Recipes picked for your goal."].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--hm-basket-ink)]" /> {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div
        className="fixed inset-x-0 z-(--z-sticky) px-3 lg:hidden"
        style={{ bottom: signedIn ? "calc(var(--dock-height) + var(--dock-inset) + 0.5rem)" : "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-full bg-paper-white p-1.5 pl-5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35),0_0_0_1px_var(--hm-line)]">
          <div className="min-w-0 flex-1 text-[13px] leading-tight">
            {toGet > 0 && !result && <p className="font-semibold tabular-nums">from {formatNaira(cost)}</p>}
            <p className="truncate text-[var(--hm-ink-2)]">
              {fromBasket} of {total} ingredients
            </p>
          </div>
          <div className="shrink-0 [&>*]:px-5">{action("sm")}</div>
        </div>
      </div>
    </>
  );
}
