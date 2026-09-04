"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import {
  PLANNER_GOALS,
  PLANNER_EXAMPLES,
  type ProducePlan,
  type PlanIdea,
  type PlanLine,
} from "@/lib/produce-planner";

type Result = { plan: ProducePlan } | { redirect: string } | { plan: null };

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

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Produce Planner</h2>
      <p className="mt-1 text-sm text-muted">
        Fruit and vegetable ideas for your week. Everything on the list comes from our shelves.
      </p>

      {!plan && !redirect && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) call({ mode: "text", text: text.trim() });
            }}
            className="mt-4 flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a goal, a fruit, or a vegetable"
              className="flex-1 rounded-full border border-border px-4 py-2 text-sm"
            />
            <button
              disabled={loading || !text.trim()}
              className="rounded-full bg-ripe-green px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Working" : "Plan it"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {PLANNER_EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setText(ex);
                  call({ mode: "text", text: ex });
                }}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-ripe-green-light"
              >
                {ex}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Or point me at the week</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLANNER_GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => call({ mode: "goal", goalId: g.id })}
                className="rounded-full border border-ripe-green/40 px-3 py-1.5 text-xs font-medium text-ripe-green hover:bg-ripe-green-light"
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <button
              onClick={() => call({ mode: "week" })}
              className="rounded-full bg-ripe-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-ripe-terracotta-dark"
            >
              Give me this week&rsquo;s picks
            </button>
            {cart.items.length > 0 && (
              <button
                onClick={() => call({ mode: "cart", cartSlugs: cart.items.map((i) => i.slug) })}
                className="text-ripe-green underline"
              >
                Read what&rsquo;s in my cart
              </button>
            )}
            <label className="ml-auto flex items-center gap-1 text-xs text-muted">
              for
              <input
                type="number"
                min={1}
                max={20}
                value={servings}
                onChange={(e) => setServings(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-14 rounded-lg border border-border px-2 py-1"
              />
              people
            </label>
          </div>
        </>
      )}

      {redirect && (
        <div className="mt-4 rounded-xl bg-ripe-terracotta-light/50 p-4 text-sm text-ripe-terracotta-dark">
          <p>{redirect}</p>
          <button onClick={reset} className="mt-2 text-xs font-medium underline">
            Try again
          </button>
        </div>
      )}

      {result && "plan" in result && result.plan === null && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          We could not turn that into a produce plan. Try a fruit, a vegetable, or one of the goals above.
          <button onClick={reset} className="ml-2 text-xs font-medium text-ripe-green underline">
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
    <div className="mt-5 border-t border-border pt-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{plan.title}</h3>
        <button onClick={onReset} className="text-xs text-ripe-green underline">
          Start over
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">{plan.intro}</p>

      <div className="mt-4 space-y-4">
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
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {addedAll ? (
            <span className="text-sm font-medium text-ripe-green">
              Added the produce for this plan.{" "}
              <Link href="/cart" className="underline">View cart</Link>
            </span>
          ) : (
            <button
              disabled={busy}
              onClick={() => addLines(allLines, "all")}
              className="rounded-full bg-ripe-terracotta px-6 py-2.5 text-sm font-medium text-white hover:bg-ripe-terracotta-dark disabled:opacity-60"
            >
              Add everything for this plan · {formatNaira(plan.combinedTotal)}
            </button>
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
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">
          {idea.name}
          <span className="ml-2 rounded-full bg-ripe-green-light px-2 py-0.5 text-[11px] font-medium text-ripe-green">
            {idea.kindLabel}
          </span>
        </p>
        <span className="shrink-0 text-xs text-muted">
          {idea.servings} servings · {idea.timeMinutes} min
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {idea.produce.map((l) => (
          <span
            key={l.productId}
            className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs"
          >
            <ProductImage
              publicId={l.cloudinaryPublicId}
              alt={l.name}
              emoji={l.imageEmoji}
              className="h-5 w-5"
              rounded="rounded-full"
              emojiClassName="text-xs"
              sizes="20px"
            />
            {l.name} × {l.quantity}
          </span>
        ))}
      </div>

      <p className="mt-3 text-sm text-muted">{idea.method}</p>
      {idea.pantry.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          From your kitchen: {idea.pantry.join(", ")}.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        {added ? (
          <span className="text-xs font-medium text-ripe-green">Added</span>
        ) : (
          <button
            disabled={busy}
            onClick={onAdd}
            className="rounded-full border border-ripe-green px-4 py-1.5 text-xs font-medium text-ripe-green hover:bg-ripe-green-light disabled:opacity-60"
          >
            Add the produce · {formatNaira(idea.produceTotal)}
          </button>
        )}
      </div>
    </div>
  );
}
