"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { GOALS } from "@/lib/assistant";
import { PRODUCE_PREFERENCE_LABEL, PRODUCE_PREFERENCE_OPTIONS, formatNaira } from "@/lib/format";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import { buildStarterPicks, type StarterCandidate, type StarterPick } from "@/lib/starter-basket-core";
import { ProductImage } from "@/components/product-image";
import { SITE_NAME } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { StepIndicator } from "@/components/step-indicator";
import { RollingNumber } from "@/components/ui/rolling-number";
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

// Steps, in order: 0 interstitial, 1-4 questions, 5 saving beat, 6 basket
// preview, 7 the fifth question (ship day), 8 account creation. Only the five
// real questions get a "Step N of 5" counter; the interstitial, the saving
// beat, the preview and the account screen are not questions.
const LAST_STEP = 8;
const QUESTION_NUMBER: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 7: 5 };
const TOTAL_QUESTIONS = 5;

export function StartFlow({
  candidates,
  error,
  next,
}: {
  candidates: StarterCandidate[];
  error: string | null;
  next: string | null;
}) {
  // Land back on the account screen if validation bounced us here.
  const [[step, direction], setStepState] = useState<[number, 1 | -1]>([error ? LAST_STEP : 0, 1]);
  const setStep = (updater: number | ((s: number) => number)) =>
    setStepState(([s]) => {
      const next = typeof updater === "function" ? (updater as (s: number) => number)(s) : updater;
      return [next, next >= s ? 1 : -1];
    });
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

  const suggestedPicks = useMemo(
    () =>
      buildStarterPicks(
        { goalSlug: data.goal, producePreferences: data.produce, adults: data.adults, kids: data.kids },
        candidates,
      ),
    [data.goal, data.produce, data.adults, data.kids, candidates],
  );

  // The system's suggestion is a starting point, not a lock: seeded once from
  // the algorithmic picks, then edited freely with its own add/remove state.
  const [customPicks, setCustomPicks] = useState<StarterPick[] | null>(null);
  const picks = customPicks ?? suggestedPicks;
  const previewValue = picks.reduce((sum, p) => sum + p.standardPrice * p.quantity, 0);
  const removePick = (productId: string) =>
    setCustomPicks((picks ?? suggestedPicks).filter((p) => p.productId !== productId));
  const addCandidate = (c: StarterCandidate) =>
    setCustomPicks([
      ...(customPicks ?? suggestedPicks),
      {
        productId: c.id,
        slug: c.slug,
        name: c.name,
        quantity: c.minOrderQty,
        imageEmoji: c.imageEmoji,
        cloudinaryPublicId: c.cloudinaryPublicId,
        memberPrice: c.memberPrice,
        standardPrice: c.standardPrice,
      },
    ]);
  const pickedIds = new Set(picks.map((p) => p.productId));
  const moreToAdd = candidates.filter((c) => !pickedIds.has(c.id)).slice(0, 8);

  // Screen 5: brief "saving" beat, then auto-advance.
  useEffect(() => {
    if (step !== 5) return;
    const t = setTimeout(() => setStep(6), 1200);
    return () => clearTimeout(t);
  }, [step]);

  const canNext =
    step === 0 ||
    (step === 1 && data.goal) ||
    (step === 2 && data.produce.length > 0) ||
    step === 3 ||
    (step === 4 && (data.dietary !== "allergies" || data.dietaryDetail.trim().length > 0)) ||
    step === 6 ||
    (step === 7 && data.windowDay);

  const goNext = () => setStep((s) => Math.min(LAST_STEP, s === 4 ? 5 : s + 1));
  const back = () => setStep((s) => Math.max(0, s === 6 ? 4 : s - 1));

  const questionNumber = QUESTION_NUMBER[step];

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-heading tracking-tight text-carbon">
          {SITE_NAME}
        </Link>
        <Link href="/login" className="text-xs text-muted underline">
          Sign in
        </Link>
      </div>

      {questionNumber && (
        <div className="mt-6">
          <StepIndicator
            steps={Array.from({ length: TOTAL_QUESTIONS }, (_, i) => `${i + 1}`)}
            currentStep={questionNumber}
          />
        </div>
      )}

      <div className="mt-8 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        variants={{
          enter: (d: number) => ({ x: 40 * d, opacity: 0 }),
          center: { x: 0, opacity: 1 },
          exit: (d: number) => ({ x: -40 * d, opacity: 0 }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={spring.smooth}
      >
        {step === 0 && (
          <div>
            <h1 className="text-heading">Let&rsquo;s get you set up</h1>
            <p className="mt-3 text-base text-muted">
              First, a few quick questions so your baskets and suggestions actually fit you, then
              you&rsquo;re in. Takes about a minute.
            </p>
          </div>
        )}

        {step === 1 && (
          <Screen why="This is the one answer Ideas leans on when it suggests things.">
            <h1 className="text-heading">What are you hoping to get out of shopping with Basket?</h1>
            <p className="mt-2 text-sm text-muted">Pick the one that fits best. You can change it later.</p>
            <div className="mt-6 grid gap-3">
              {GOALS.map((g) => (
                <OptionCard
                  key={g.slug}
                  groupId="goal"
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

        {step === 2 && (
          <Screen why="So your basket leans towards what you actually reach for.">
            <h1 className="text-heading">What do you usually reach for?</h1>
            <p className="mt-2 text-sm text-muted">Choose as many as you like.</p>
            <button
              type="button"
              onClick={toggleAllProduce}
              className={`mt-6 flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm ${
                allProduce ? "border-border bg-lavender" : "border-border bg-paper-white"
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

        {step === 3 && (
          <Screen why="This sizes the quantities we suggest, nothing else.">
            <h1 className="text-heading">Who are you shopping for?</h1>
            <p className="mt-2 text-sm text-muted">So basket quantities are about right for your table.</p>
            <div className="mt-6 space-y-3">
              <Counter label="Adults" value={data.adults} min={1} onChange={(v) => set("adults", v)} />
              <Counter label="Kids" value={data.kids} min={0} onChange={(v) => set("kids", v)} />
            </div>
          </Screen>
        )}

        {step === 4 && (
          <Screen why="So we can keep suggestions clear of anything you avoid.">
            <h1 className="text-heading">Anything we should know?</h1>
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
                  groupId="dietary"
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

        {step === 5 && (
          <div className="py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-carbon" />
            <p className="mt-4 text-sm text-muted">Saving your answers…</p>
          </div>
        )}

        {step === 6 && (
          <Screen why="This is a starting point. Add or remove anything before your account is made.">
            <h1 className="text-heading">Here is a first basket to start from</h1>
            <p className="mt-2 text-sm text-muted">
              Built from what you told us. Remove what you don&rsquo;t want, add what&rsquo;s missing.
            </p>
            {picks.length > 0 ? (
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
                    <button
                      type="button"
                      onClick={() => removePick(p.productId)}
                      aria-label={`Remove ${p.name}`}
                      className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sky-wash hover:text-carbon"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-muted">Nothing in here yet. Add something below.</p>
            )}

            {moreToAdd.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Add something else</p>
                <div className="flex flex-wrap gap-2">
                  {moreToAdd.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addCandidate(c)}
                      className="flex items-center gap-1.5 rounded-full border border-border py-1.5 pl-1.5 pr-3 text-xs font-medium hover:bg-sky-wash"
                    >
                      <ProductImage
                        publicId={c.cloudinaryPublicId}
                        alt={c.name}
                        emoji={c.imageEmoji}
                        className="h-6 w-6"
                        rounded="rounded-full"
                        emojiClassName="text-sm"
                        sizes="24px"
                      />
                      {c.name} +
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-between border-t border-border pt-4 text-sm font-semibold">
              <span>Rough weekly value</span>
              <span>{formatNaira(previewValue)}</span>
            </div>
          </Screen>
        )}

        {step === 7 && (
          <Screen why="Pick the day. Nothing is charged and no clock starts.">
            <h1 className="text-heading">Which day would your basket ship?</h1>
            <p className="mt-2 text-sm text-muted">
              This just sets the day your basket would go out if you check out. It does not commit you to
              anything and it does not start a countdown. You pay when you decide to, not before.
            </p>
            <div className="mt-6 grid gap-3">
              {SHOPPING_WINDOW_DAYS.map((d) => (
                <OptionCard
                  key={d.day}
                  groupId="window-day"
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

        {step === 8 && (
          <Screen why="Email and password only. No address, no card.">
            <h1 className="text-heading">Create your account</h1>
            <p className="mt-2 text-sm text-muted">
              Your basket and answers are saved to this account. It is free and separate from any
              subscription.
            </p>

            {error && (
              <p className="mt-4 rounded-input border border-border bg-ember/12 p-3 text-sm text-carbon">
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
              <input
                type="hidden"
                name="starterPicks"
                value={JSON.stringify(picks.map((p) => ({ productId: p.productId, quantity: p.quantity })))}
              />
              {next && <input type="hidden" name="next" value={next} />}

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
              <PasswordField name="password" label="Password" required minLength={8} />
              <Button type="submit" size="lg" className="w-full">
                Create account
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login" className="text-carbon underline">Sign in</Link>
            </p>
          </Screen>
        )}
      </motion.div>
      </AnimatePresence>
      </div>

      {step < LAST_STEP && step !== 5 && (
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <Button onClick={back} variant="secondary" size="sm" className="tap-target">
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={goNext} disabled={!canNext} size="sm" className="tap-target">
            {step === 0 ? "Let's go" : step === 6 ? "Looks good" : step === 7 ? "Continue" : "Next"}
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
      <p className="mt-6 rounded-xl bg-sky-wash p-3 text-xs text-carbon">{why}</p>
    </div>
  );
}

function OptionCard({
  emoji,
  title,
  sub,
  selected,
  onClick,
  groupId,
}: {
  emoji: string;
  title: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
  /** Options in the same question share this, so the selection ring slides between them. */
  groupId?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: press.scaleLarge }}
      transition={spring.snappy}
      className={`relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        selected ? "border-border bg-lavender" : "border-border bg-paper-white hover:bg-sky-wash"
      }`}
    >
      {selected && groupId && (
        <motion.span
          layoutId={`${groupId}-ring`}
          transition={spring.indicator}
          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-carbon"
          aria-hidden
        />
      )}
      <span className="relative text-2xl leading-none">{emoji}</span>
      <span className="relative min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
      </span>
    </motion.button>
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
        <motion.button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          whileTap={{ scale: press.scale }}
          transition={spring.snappy}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border text-lg disabled:opacity-30"
        >
          <Icon name="minus" size={16} />
        </motion.button>
        <RollingNumber value={value} className="w-5 text-center text-sm font-semibold" />
        <motion.button
          type="button"
          onClick={() => onChange(Math.min(12, value + 1))}
          whileTap={{ scale: press.scale }}
          transition={spring.snappy}
          aria-label={`More ${label.toLowerCase()}`}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border text-lg"
        >
          <Icon name="plus" size={16} />
        </motion.button>
      </div>
    </div>
  );
}
