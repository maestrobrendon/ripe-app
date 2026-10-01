"use client";

import { useState, useTransition } from "react";
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
import { buildVarietySummary, PREP_GROUP_LABEL, COLOR_LABEL, type PrepGroup } from "@/lib/produce-variety";
import { saveProducePlan, makeThisMyBasket } from "./produce-plan-actions";

type Result = (({ plan: ProducePlan } | { redirect: string } | { plan: null }) & { usesLeft: number | null }) | { locked: true; usesLeft: 0 };

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

export function ProducePlanner({
  defaultServings,
  initialUsesLeft,
  signedIn = false,
}: {
  defaultServings: number;
  /** null for a signed-in account (uncapped); a count for a guest. */
  initialUsesLeft: number | null;
  signedIn?: boolean;
}) {
  const cart = useCart();
  const [servings, setServings] = useState(defaultServings);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [usesLeft, setUsesLeft] = useState(initialUsesLeft);
  const [locked, setLocked] = useState(initialUsesLeft === 0);

  const call = async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings, ...payload }),
      });
      const data = (await res.json()) as Result;
      setUsesLeft(data.usesLeft);
      if ("locked" in data && data.locked) {
        setLocked(true);
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
  };

  const plan = result && "plan" in result ? result.plan : null;
  const redirect = result && "redirect" in result ? result.redirect : null;
  const failed = result !== null && "plan" in result && result.plan === null;

  if (locked) {
    return (
      <div className="rounded-card-lg border border-dashed border-border bg-surface p-5 sm:p-8">
        <h3 className="text-heading">You&rsquo;ve used today&rsquo;s free picks</h3>
        <p className="mt-2 text-muted">
          Create an account to keep planning — no card needed, and your picks carry straight into a
          basket.
        </p>
        <Link
          href="/start"
          className="tap-target mt-5 inline-flex items-center gap-2 rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white hover:bg-carbon/85"
        >
          Create an account to keep planning
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
      {/* Servings sits with the title because it applies to every route in,
          not just the button it used to sit beside. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-heading">Produce Planner</h3>
          <p className="mt-1 text-muted">Everything it suggests comes off our shelves.</p>
        </div>
        <Servings value={servings} onChange={setServings} />
      </div>

      {usesLeft !== null && (
        <p className="mt-3 text-xs font-medium text-muted">
          {usesLeft} free {usesLeft === 1 ? "pick" : "picks"} left today
        </p>
      )}

      {!plan && !redirect && (
        <div className="mt-8">
          {/* One row of themes. There used to be two, and they overlapped:
              "More greens this week" appeared in both, doing different things. */}
          <p className="text-sm font-semibold">Pick a theme</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLANNER_GOALS.map((g) => (
              <button
                key={g.id}
                disabled={loading}
                onClick={() => call({ mode: "goal", goalId: g.id })}
                className="tap-target rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-sky-wash disabled:opacity-50"
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
                className="text-sm font-semibold text-carbon underline disabled:opacity-50"
              >
                Plan around what is in my cart
              </button>
            )}
          </div>
        </div>
      )}

      {redirect && (
        <div className="mt-6 rounded-card border border-border bg-ember/12 p-4 text-carbon">
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
          <button onClick={reset} className="mt-3 text-sm font-semibold text-carbon underline">
            Start over
          </button>
        </div>
      )}

      {plan && (
        <PlanView plan={plan} servings={servings} signedIn={signedIn} onReset={reset} onRefresh={() => cart.refresh()} />
      )}
    </div>
  );
}

export function PlanView({
  plan,
  servings,
  signedIn = false,
  onReset,
  onRefresh,
}: {
  plan: ProducePlan;
  servings?: number;
  signedIn?: boolean;
  onReset?: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [addedAll, setAddedAll] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [madeBasket, setMadeBasket] = useState(false);
  const [saved, setSaved] = useState(false);

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
  const variety = buildVarietySummary(allLines, servings ?? 1);
  const prepByProductId = new Map<string, PrepGroup>();
  (Object.keys(variety.groups) as PrepGroup[]).forEach((group) =>
    variety.groups[group].forEach((l) => prepByProductId.set(l.productId, group)),
  );
  const goalId = plan.key.startsWith("goal:") ? plan.key.slice("goal:".length) : undefined;

  const handleMakeBasket = () =>
    startTransition(async () => {
      await makeThisMyBasket(allLines.map((l) => ({ productId: l.productId, quantity: l.quantity })));
      setMadeBasket(true);
    });

  const handleSave = () =>
    startTransition(async () => {
      await saveProducePlan({
        weekStart: new Date().toISOString(),
        householdSize: servings ?? 1,
        goal: goalId,
        theme: plan.title,
        items: allLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          prep: prepByProductId.get(l.productId) ?? "either",
        })),
      });
      setSaved(true);
    });

  return (
    <div className="mt-8 border-t border-border pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="text-heading">{plan.title}</h4>
        {onReset && (
          <button onClick={onReset} className="text-sm font-semibold text-carbon underline">
            Start over
          </button>
        )}
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
            <p className="flex flex-wrap items-center gap-2 font-semibold text-carbon">
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

      {/* Deterministic variety summary, not model-written: grouped by whether
          you'd eat it raw or cook it, plus a grams/person/day figure that
          only counts items we actually have weight data for. */}
      <div className="mt-6 border-t border-border pt-6">
        <p className="text-sm font-semibold">This week, grouped</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {(["raw", "cooked", "either"] as PrepGroup[]).map((group) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{PREP_GROUP_LABEL[group]}</p>
              {variety.groups[group].length === 0 ? (
                <p className="mt-1 text-sm text-muted">None this week.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {variety.groups[group].map((l) => (
                    <li key={l.productId}>{l.name} × {l.quantity}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          <span className="font-semibold text-carbon">
            {variety.colorsCovered.length} of {variety.colorsTotal} colours
          </span>{" "}
          covered
          {variety.colorsCovered.length > 0 && <> — {variety.colorsCovered.map((c) => COLOR_LABEL[c]).join(", ")}</>}.
        </p>
        {variety.gramsPerPersonPerDay != null ? (
          <p className="mt-4 text-sm text-muted">
            About <span className="font-semibold text-carbon">{variety.gramsPerPersonPerDay}g</span> per person per
            day from this plan, against the commonly cited 400g guideline — counts {variety.countedTowardGrams} of{" "}
            {variety.totalLines} items we have weight data for. Informational only, not medical advice.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Not enough weight data on this week&rsquo;s items to estimate grams per day.
          </p>
        )}
      </div>

      {signedIn && (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6">
          <button
            type="button"
            disabled={isPending}
            onClick={handleMakeBasket}
            className="rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {madeBasket ? "Added to your basket" : "Make this my basket"}
          </button>
          <button
            type="button"
            disabled={isPending || saved}
            onClick={handleSave}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-sky-wash disabled:opacity-50"
          >
            {saved ? "Plan saved" : "Save plan"}
          </button>
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
      <span className="mt-2 inline-block rounded-full bg-sky-wash px-3 py-0.5 text-xs font-semibold text-carbon">
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
          <p className="flex items-center gap-2 text-sm font-semibold text-carbon">
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
