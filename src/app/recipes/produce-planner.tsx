"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import {
  PLANNER_GOALS,
  type ProducePlan,
  type PlanIdea,
  type PlanLine,
} from "@/lib/produce-planner";

type Result = { plan: ProducePlan } | { redirect: string } | { plan: null };

function Servings({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Cooking for</span>
      <div className="flex items-center gap-1 rounded-full border border-border p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          aria-label="Fewer people"
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
        >
          <Icon name="minus" size={15} />
        </button>
        <span className="w-6 text-center text-sm font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(20, value + 1))}
          disabled={value >= 20}
          aria-label="More people"
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
        >
          <Icon name="plus" size={15} />
        </button>
      </div>
    </div>
  );
}

export function ProducePlanner({ defaultServings }: { defaultServings: number }) {
  const cart = useCart();
  const [text, setText] = useState("");
  const [servings, setServings] = useState(defaultServings);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const call = async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings, ...payload }),
      });
      setResult((await res.json()) as Result);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setText("");
  };

  const plan = result && "plan" in result ? result.plan : null;
  const redirect = result && "redirect" in result ? result.redirect : null;
  const failed = result !== null && "plan" in result && result.plan === null;

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
      {/* Servings sits with the title because it applies to every route in,
          not just the button it used to sit beside. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-heading-sm">Produce Planner</h3>
          <p className="mt-1 text-muted">Everything it suggests comes off our shelves.</p>
        </div>
        <Servings value={servings} onChange={setServings} />
      </div>

      {!plan && !redirect && (
        <div className="mt-8">
          <label htmlFor="planner-input" className="text-sm font-semibold">
            What are you working with?
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) call({ mode: "text", text: text.trim() });
            }}
            className="mt-2 flex flex-col gap-2 sm:flex-row"
          >
            <input
              id="planner-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A watermelon, a pepper base, lighter dinners"
              className="flex-1 rounded-full border border-border px-5 py-3 text-base"
            />
            <Button type="submit" disabled={loading || !text.trim()} size="md" className="shrink-0">
              {loading ? "Working" : "Plan it"}
            </Button>
          </form>

          {/* One row of themes. There used to be two, and they overlapped:
              "More greens this week" appeared in both, doing different things. */}
          <p className="mt-8 text-sm font-semibold">Or pick a theme</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLANNER_GOALS.map((g) => (
              <button
                key={g.id}
                disabled={loading}
                onClick={() => call({ mode: "goal", goalId: g.id })}
                className="tap-target rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-basket-green hover:bg-basket-green-light disabled:opacity-50"
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => call({ mode: "week" })}
            >
              Surprise me with this week&rsquo;s picks
            </Button>
            {cart.items.length > 0 && (
              <button
                disabled={loading}
                onClick={() => call({ mode: "cart", cartSlugs: cart.items.map((i) => i.slug) })}
                className="text-sm font-semibold text-basket-green underline disabled:opacity-50"
              >
                Plan around what is in my cart
              </button>
            )}
          </div>
        </div>
      )}

      {redirect && (
        <div className="mt-6 rounded-card border border-basket-terracotta/40 bg-basket-terracotta-light/50 p-4 text-basket-terracotta-dark">
          <p>{redirect}</p>
          <button onClick={reset} className="mt-3 text-sm font-semibold underline">
            Try something else
          </button>
        </div>
      )}

      {failed && (
        <div className="mt-6 rounded-card border border-dashed border-border p-4">
          <p className="text-muted">
            We could not turn that into a produce plan. Try a fruit, a vegetable, or one of the themes.
          </p>
          <button onClick={reset} className="mt-3 text-sm font-semibold text-basket-green underline">
            Start over
          </button>
        </div>
      )}

      {plan && <PlanView plan={plan} onReset={reset} onRefresh={() => cart.refresh()} />}
    </div>
  );
}

function PlanView({
  plan,
  onReset,
  onRefresh,
}: {
  plan: ProducePlan;
  onReset: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [addedAll, setAddedAll] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const addLines = async (lines: PlanLine[], key: string) => {
    setBusy(true);
    await fetch("/api/cart/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) }),
    });
    await onRefresh();
    setBusy(false);
    if (key === "all") setAddedAll(true);
    else setAdded((a) => ({ ...a, [key]: true }));
  };

  const allLines = Array.from(
    new Map(plan.ideas.flatMap((i) => i.produce).map((l) => [l.productId, l])).values(),
  );

  return (
    <div className="mt-8 border-t border-border pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="text-heading-sm">{plan.title}</h4>
        <button onClick={onReset} className="text-sm font-semibold text-basket-green underline">
          Start over
        </button>
      </div>
      <p className="mt-2 text-muted">{plan.intro}</p>

      <div className="mt-6 space-y-4">
        {plan.ideas.map((idea) => (
          <IdeaCard
            key={idea.slug}
            idea={idea}
            added={Boolean(added[idea.slug])}
            busy={busy}
            onAdd={() => addLines(idea.produce, idea.slug)}
          />
        ))}
      </div>

      {plan.ideas.length > 1 && (
        <div className="mt-6 border-t border-border pt-6">
          {addedAll ? (
            <p className="flex flex-wrap items-center gap-2 font-semibold text-basket-green">
              <Icon name="check" size={18} />
              Added the produce for this plan.
              <Link href="/cart" className="underline">
                View cart
              </Link>
            </p>
          ) : (
            <Button disabled={busy} onClick={() => addLines(allLines, "all")} size="lg">
              Add everything · {formatNaira(plan.combinedTotal)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  added,
  busy,
  onAdd,
}: {
  idea: PlanIdea;
  added: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-card border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h5 className="text-base font-bold">{idea.name}</h5>
        <span className="shrink-0 text-sm text-muted">
          {idea.servings} servings · {idea.timeMinutes} min
        </span>
      </div>
      <span className="mt-2 inline-block rounded-full bg-basket-green-light px-3 py-0.5 text-xs font-semibold text-basket-green">
        {idea.kindLabel}
      </span>

      <p className="mt-4 text-muted">{idea.method}</p>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">You will need</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {idea.produce.map((l) => (
          <span
            key={l.productId}
            className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm"
          >
            <ProductImage
              publicId={l.cloudinaryPublicId}
              alt={l.name}
              emoji={l.imageEmoji}
              className="h-7 w-7"
              rounded="rounded-full"
              emojiClassName="text-sm"
              sizes="28px"
            />
            {l.name} × {l.quantity}
          </span>
        ))}
      </div>
      {idea.pantry.length > 0 && (
        <p className="mt-3 text-sm text-muted">From your kitchen: {idea.pantry.join(", ")}.</p>
      )}

      <div className="mt-5">
        {added ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-basket-green">
            <Icon name="check" size={16} />
            Added to cart
          </p>
        ) : (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onAdd}>
            Add the produce · {formatNaira(idea.produceTotal)}
          </Button>
        )}
      </div>
    </div>
  );
}
