"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GOALS } from "@/lib/assistant";
import { PRODUCE_PREFERENCE_LABEL, PRODUCE_PREFERENCE_OPTIONS, formatNaira } from "@/lib/format";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import { buildStarterPicks, type StarterCandidate } from "@/lib/starter-basket-core";
import { ProductImage } from "@/components/product-image";
import { SITE_NAME } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { createAccountFromOnboarding } from "./actions";
import { Icon } from "@/components/ui/icon";

type Dietary = "none" | "vegetarian" | "vegan" | "allergies";
type WindowDay = "THURSDAY" | "FRIDAY" | "SATURDAY";

type Data = {
  goal: string | null;
  produce: string[];
  adults: number;
  kids: number;
  dietary: Dietary;
  dietaryDetail: string;
  windowDay: WindowDay | null;
};

const GOAL_EMOJI: Record<string, string> = {
  "post-workout-recovery": "🏃",
  "family-household": "🏡",
  "general-wellness": "🌱",
  "weight-management": "🥗",
};

const PRODUCE_EMOJI: Record<string, string> = {
  fruits: "🍎",
  vegetables: "🥕",
  "leafy-greens": "🥬",
  "root-veg": "🥔",
  herbs: "🌿",
};

const TOTAL_STEPS = 7;

export function StartFlow({
  candidates,
  error,
}: {
  candidates: StarterCandidate[];
  error: string | null;
}) {
  // Land back on the account screen if validation bounced us here.
  const [step, setStep] = useState(error ? 7 : 0);
  const [data, setData] = useState<Data>({
    goal: null,
    produce: [],
    adults: 1,
    kids: 0,
    dietary: "none",
    dietaryDetail: "",
    windowDay: null,
  });

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setData((d) => ({ ...d, [k]: v }));

  const allProduce = data.produce.length === PRODUCE_PREFERENCE_OPTIONS.length;
  const toggleProduce = (slug: string) =>
    set("produce", data.produce.includes(slug) ? data.produce.filter((p) => p !== slug) : [...data.produce, slug]);
  const toggleAllProduce = () =>
    set("produce", allProduce ? [] : [...PRODUCE_PREFERENCE_OPTIONS]);

  const picks = useMemo(
    () =>
      buildStarterPicks(
        { goalSlug: data.goal, producePreferences: data.produce, adults: data.adults, kids: data.kids },
        candidates,
      ),
    [data.goal, data.produce, data.adults, data.kids, candidates],
  );
  const previewValue = picks.reduce((sum, p) => sum + p.standardPrice * p.quantity, 0);

  // Screen 5: brief "saving" beat, then auto-advance.
  useEffect(() => {
    if (step !== 4) return;
    const t = setTimeout(() => setStep(5), 1200);
    return () => clearTimeout(t);
  }, [step]);

  const canNext =
    (step === 0 && data.goal) ||
    (step === 1 && data.produce.length > 0) ||
    step === 2 ||
    (step === 3 && (data.dietary !== "allergies" || data.dietaryDetail.trim().length > 0)) ||
    step === 5 ||
    (step === 6 && data.windowDay);

  const next = () => setStep((s) => Math.min(7, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-heading-sm tracking-tight text-basket-green">
          {SITE_NAME}
        </Link>
        <Link href="/login" className="text-xs text-muted underline">
          Sign in
        </Link>
      </div>

      {step < TOTAL_STEPS && step !== 4 && (
        <div className="mt-6">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-basket-green transition-all"
              style={{ width: `${(Math.min(step, TOTAL_STEPS - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-8">
        {step === 0 && (
          <Screen why="This is the one answer the trained assistant leans on when it suggests things.">
            <h1 className="text-heading-sm">What are you hoping to get out of shopping with Basket?</h1>
            <p className="mt-2 text-sm text-muted">Pick the one that fits best. You can change it later.</p>
            <div className="mt-6 grid gap-3">
              {GOALS.map((g) => (
                <OptionCard
                  key={g.slug}
                  emoji={GOAL_EMOJI[g.slug]}
                  title={g.label}
                  sub={g.description}
                  selected={data.goal === g.slug}
                  onClick={() => set("goal", g.slug)}
                />
              ))}
            </div>
          </Screen>
        )}

        {step === 1 && (
          <Screen why="So your basket leans towards what you actually reach for.">
            <h1 className="text-heading-sm">What do you usually reach for?</h1>
            <p className="mt-2 text-sm text-muted">Choose as many as you like.</p>
            <button
              type="button"
              onClick={toggleAllProduce}
              className={`mt-6 flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm ${
                allProduce ? "border-basket-green bg-basket-green-light" : "border-border"
              }`}
            >
              <span className="text-xl">🧺</span>
              <span className="font-medium">A bit of everything</span>
            </button>
            <div className="mt-3 grid gap-3">
              {PRODUCE_PREFERENCE_OPTIONS.map((slug) => (
                <OptionCard
                  key={slug}
                  emoji={PRODUCE_EMOJI[slug]}
                  title={PRODUCE_PREFERENCE_LABEL[slug]}
                  selected={data.produce.includes(slug)}
                  onClick={() => toggleProduce(slug)}
                />
              ))}
            </div>
          </Screen>
        )}

        {step === 2 && (
          <Screen why="This sizes the quantities we suggest, nothing else.">
            <h1 className="text-heading-sm">Who are you shopping for?</h1>
            <p className="mt-2 text-sm text-muted">So basket quantities are about right for your table.</p>
            <div className="mt-6 space-y-3">
              <Counter label="Adults" value={data.adults} min={1} onChange={(v) => set("adults", v)} />
              <Counter label="Kids" value={data.kids} min={0} onChange={(v) => set("kids", v)} />
            </div>
          </Screen>
        )}

        {step === 3 && (
          <Screen why="So we can keep suggestions clear of anything you avoid.">
            <h1 className="text-heading-sm">Anything we should know?</h1>
            <div className="mt-6 grid gap-3">
              {(
                [
                  ["none", "No restrictions", "🍽️"],
                  ["vegetarian", "Vegetarian", "🥦"],
                  ["vegan", "Vegan", "🌱"],
                  ["allergies", "Allergies or dislikes", "⚠️"],
                ] as const
              ).map(([value, label, emoji]) => (
                <OptionCard
                  key={value}
                  emoji={emoji}
                  title={label}
                  selected={data.dietary === value}
                  onClick={() => set("dietary", value)}
                />
              ))}
            </div>
            {data.dietary === "allergies" && (
              <textarea
                rows={2}
                autoFocus
                value={data.dietaryDetail}
                onChange={(e) => set("dietaryDetail", e.target.value)}
                placeholder="What should we keep out of your basket?"
                className="mt-3 w-full rounded-input border border-border px-3 py-2 text-sm"
              />
            )}
          </Screen>
        )}

        {step === 4 && (
          <div className="py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-basket-green" />
            <p className="mt-4 text-sm text-muted">Saving your answers</p>
          </div>
        )}

        {step === 5 && (
          <Screen why="You can change every item after your account is made.">
            <h1 className="text-heading-sm">Here is a first basket to start from</h1>
            <p className="mt-2 text-sm text-muted">
              Built from what you told us. Nothing is set in stone, you edit it whenever you like.
            </p>
            <ul className="mt-6 space-y-3">
              {picks.map((p) => (
                <li key={p.productId} className="flex items-center gap-3">
                  <ProductImage
                    publicId={p.cloudinaryPublicId}
                    alt={p.name}
                    emoji={p.imageEmoji}
                    className="h-12 w-12 shrink-0"
                    rounded="rounded-xl"
                    emojiClassName="text-2xl"
                    sizes="48px"
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 text-sm text-muted">× {p.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-between border-t border-border pt-4 text-sm font-semibold">
              <span>Rough weekly value</span>
              <span>{formatNaira(previewValue)}</span>
            </div>
          </Screen>
        )}

        {step === 6 && (
          <Screen why="Pick the day. Nothing is charged and no clock starts.">
            <h1 className="text-heading-sm">Which day would your basket ship?</h1>
            <p className="mt-2 text-sm text-muted">
              This just sets the day your basket would go out if you check out. It does not commit you to
              anything and it does not start a countdown. You pay when you decide to, not before.
            </p>
            <div className="mt-6 grid gap-3">
              {SHOPPING_WINDOW_DAYS.map((d) => (
                <OptionCard
                  key={d.day}
                  emoji="📦"
                  title={d.label}
                  sub={d.cutoffCopy}
                  selected={data.windowDay === d.day}
                  onClick={() => set("windowDay", d.day)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Cutoff times are placeholders until we confirm delivery operations.
            </p>
          </Screen>
        )}

        {step === 7 && (
          <Screen why="Email and password only. No address, no card.">
            <h1 className="text-heading-sm">Create your account</h1>
            <p className="mt-2 text-sm text-muted">
              Your basket and answers are saved to this account. It is free and separate from any
              subscription.
            </p>

            {error && (
              <p className="mt-4 rounded-lg border border-basket-terracotta bg-basket-terracotta-light p-3 text-sm text-basket-terracotta-dark">
                {error === "failed"
                  ? "We could not create an account with those details. If you already have one, sign in instead."
                  : error === "missing"
                  ? "Enter your name, an email or phone, and a password of at least 8 characters."
                  : "Too many attempts from this network. Please wait a while and try again."}
              </p>
            )}

            <form action={createAccountFromOnboarding} className="mt-6 space-y-4">
              <input type="hidden" name="goal" value={data.goal ?? ""} />
              <input type="hidden" name="producePreferences" value={JSON.stringify(data.produce)} />
              <input type="hidden" name="adults" value={data.adults} />
              <input type="hidden" name="kids" value={data.kids} />
              <input type="hidden" name="dietary" value={data.dietary} />
              <input type="hidden" name="dietaryDetail" value={data.dietaryDetail} />
              <input type="hidden" name="windowDay" value={data.windowDay ?? ""} />

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Full name</span>
                <input name="name" required className="w-full rounded-input border border-border px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email or phone</span>
                <input
                  name="contact"
                  required
                  placeholder="you@example.com or 080..."
                  className="w-full rounded-input border border-border px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-input border border-border px-3 py-2 text-sm"
                />
              </label>
              <Button type="submit" size="lg" className="w-full">
                Create account
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login" className="text-basket-green underline">Sign in</Link>
            </p>
          </Screen>
        )}
      </div>

      {step < 7 && step !== 4 && (
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <Button onClick={back} variant="secondary" size="sm" className="tap-target">
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={next} disabled={!canNext} size="sm" className="tap-target">
            {step === 5 ? "Looks good" : step === 6 ? "Continue" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Screen({ why, children }: { why: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      <p className="mt-6 rounded-xl bg-basket-green-light/60 p-3 text-xs text-basket-green-dark">{why}</p>
    </div>
  );
}

function OptionCard({
  emoji,
  title,
  sub,
  selected,
  onClick,
}: {
  emoji: string;
  title: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        selected ? "border-basket-green bg-basket-green-light" : "border-border hover:border-basket-green/50"
      }`}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
      </span>
    </button>
  );
}

function Counter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border text-lg disabled:opacity-30"
        >
          <Icon name="minus" size={16} />
        </button>
        <span className="w-5 text-center text-sm font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(12, value + 1))}
          aria-label={`More ${label.toLowerCase()}`}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border text-lg"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}
