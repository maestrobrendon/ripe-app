"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { BUDGET_BANDS } from "@/lib/budget";
import { MEAL_PREFERENCES, MEAL_EXAMPLE_PROMPTS, type MealPlan, type PlanLine } from "@/lib/meal-planner";

type Path = "know" | "surprise";

export function MealPlanner({
  defaultBudgetBand,
  defaultServings,
}: {
  defaultBudgetBand: string | null;
  defaultServings: number;
}) {
  const cart = useCart();
  const [path, setPath] = useState<Path>("know");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);

  // Path 1
  const [text, setText] = useState("");
  // Path 2
  const [step, setStep] = useState(0);
  const [band, setBand] = useState(defaultBudgetBand ?? "");
  const [preference, setPreference] = useState("");
  const [servings, setServings] = useState(defaultServings);

  const request = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch("/api/recipes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { plan: MealPlan | null };
      if (data.plan) setPlan(data.plan);
      else {
        setPlan(null);
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitText = (value: string) => {
    setText(value);
    request({ mode: "text", text: value });
  };

  const generateSurprise = (excludeSlug?: string) =>
    request({
      mode: "surprise",
      preferenceId: preference || undefined,
      budgetBandId: band || undefined,
      servings,
      excludeSlug,
    });

  const reset = () => {
    setPlan(null);
    setNotFound(false);
    setStep(0);
  };

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Meal Planner</h2>
      <p className="mt-1 text-sm text-muted">Built by our trained assistant.</p>

      {!plan && (
        <>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { setPath("know"); reset(); }}
              className={`rounded-full px-4 py-1.5 text-sm ${path === "know" ? "bg-ripe-green text-white" : "border border-border"}`}
            >
              I know what I want
            </button>
            <button
              onClick={() => { setPath("surprise"); reset(); }}
              className={`rounded-full px-4 py-1.5 text-sm ${path === "surprise" ? "bg-ripe-green text-white" : "border border-border"}`}
            >
              Surprise me
            </button>
          </div>

          {path === "know" && (
            <div className="mt-4">
              <form
                onSubmit={(e) => { e.preventDefault(); if (text.trim()) submitText(text.trim()); }}
                className="flex gap-2"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Egusi soup for 4"
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
                {MEAL_EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => submitText(p)}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:bg-ripe-green-light"
                  >
                    {p}
                  </button>
                ))}
              </div>
              {notFound && (
                <p className="mt-3 rounded-lg bg-ripe-terracotta-light/60 p-3 text-xs text-ripe-terracotta-dark">
                  We do not have a plan for that yet. Try one of the examples, or the Surprise me path.
                </p>
              )}
            </div>
          )}

          {path === "surprise" && (
            <div className="mt-4 space-y-4">
              {step === 0 && (
                <div>
                  <p className="text-sm font-medium">Your weekly produce budget</p>
                  <div className="mt-2 space-y-1.5">
                    {BUDGET_BANDS.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-ripe-green has-[:checked]:bg-ripe-green-light"
                      >
                        <input type="radio" name="band" checked={band === b.id} onChange={() => setBand(b.id)} />
                        {b.label}
                      </label>
                    ))}
                  </div>
                  <button
                    disabled={!band}
                    onClick={() => setStep(1)}
                    className="mt-3 rounded-full bg-ripe-green px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p className="text-sm font-medium">What are you in the mood for?</p>
                  <div className="mt-2 space-y-1.5">
                    {MEAL_PREFERENCES.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-ripe-green has-[:checked]:bg-ripe-green-light"
                      >
                        <input type="radio" name="pref" checked={preference === p.id} onChange={() => setPreference(p.id)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    Cooking for
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={servings}
                      onChange={(e) => setServings(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                      className="w-16 rounded-lg border border-border px-2 py-1"
                    />
                    people
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setStep(0)} className="rounded-full border border-border px-4 py-2 text-sm">
                      Back
                    </button>
                    <button
                      disabled={loading || !preference}
                      onClick={() => generateSurprise()}
                      className="rounded-full bg-ripe-green px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {loading ? "Working" : "Suggest a dish"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {plan && (
        <PlanResult
          plan={plan}
          onModifyAdd={async (lines) => {
            await fetch("/api/cart/bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) }),
            });
            await cart.refresh();
          }}
          onTryAnother={
            path === "surprise"
              ? () => generateSurprise(plan.dishSlug)
              : () => { setPlan(null); setText(""); }
          }
        />
      )}
    </div>
  );
}

function PlanResult({
  plan,
  onModifyAdd,
  onTryAnother,
}: {
  plan: MealPlan;
  onModifyAdd: (lines: PlanLine[]) => Promise<void>;
  onTryAnother: () => void;
}) {
  const [lines, setLines] = useState(plan.inCatalog);
  const [editing, setEditing] = useState(false);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = lines.reduce((s, l) => s + l.lineCost, 0);
  const perLine = (l: PlanLine) => l.lineCost / l.quantity;

  const setQty = (id: string, q: number) =>
    setLines((prev) =>
      prev.map((l) => (l.productId === id ? { ...l, quantity: Math.max(1, q), lineCost: perLine(l) * Math.max(1, q) } : l)),
    );

  return (
    <div className="mt-5 border-t border-border pt-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{plan.dishName}</h3>
        <span className="text-xs text-muted">
          {plan.servings} servings · about {plan.timeMinutes} min
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{plan.note}</p>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">In your basket</p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {lines.map((l) => (
          <li key={l.productId} className="flex items-center gap-3 p-3">
            <ProductImage
              publicId={l.cloudinaryPublicId}
              alt={l.name}
              emoji={l.imageEmoji}
              className="h-10 w-10 shrink-0"
              emojiClassName="text-xl"
              sizes="40px"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{l.name}</p>
              <p className="text-xs text-muted">{l.unit}</p>
            </div>
            {editing ? (
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(l.productId, l.quantity - 1)} className="h-7 w-7 rounded-full border border-border">−</button>
                <span className="w-6 text-center text-sm">{l.quantity}</span>
                <button onClick={() => setQty(l.productId, l.quantity + 1)} className="h-7 w-7 rounded-full border border-border">+</button>
              </div>
            ) : (
              <span className="text-sm text-muted">× {l.quantity}</span>
            )}
            <span className="w-16 shrink-0 text-right text-sm font-medium">{formatNaira(l.lineCost)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between text-sm font-semibold">
        <span>Produce total</span>
        <span>{formatNaira(total)}</span>
      </div>

      {plan.alsoNeed.length > 0 && (
        <div className="mt-4 rounded-xl bg-ripe-green-light/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">You will also need</p>
          <p className="mt-1 text-sm">{plan.alsoNeed.join(", ")}.</p>
          <p className="mt-1 text-xs text-muted">
            These are not produce, so we do not carry them. Pick them up wherever you usually shop.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {added ? (
          <span className="text-sm font-medium text-ripe-green">
            Added to cart.{" "}
            <Link href="/cart" className="underline">View cart</Link>
          </span>
        ) : (
          <button
            disabled={busy || lines.length === 0}
            onClick={async () => {
              setBusy(true);
              await onModifyAdd(lines);
              setBusy(false);
              setAdded(true);
            }}
            className="rounded-full bg-ripe-terracotta px-6 py-2.5 text-sm font-medium text-white hover:bg-ripe-terracotta-dark disabled:opacity-60"
          >
            {busy ? "Adding" : `Add ${lines.length} items to cart`}
          </button>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-ripe-green-light"
        >
          {editing ? "Done editing" : "Modify list"}
        </button>
        <button
          onClick={onTryAnother}
          className="rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-ripe-green-light"
        >
          Try another dish
        </button>
      </div>
    </div>
  );
}
