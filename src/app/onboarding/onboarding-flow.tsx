"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { GOALS } from "@/lib/assistant";
import { BUDGET_BANDS } from "@/lib/budget";
import {
  SHOPPING_STYLE_LABEL,
  HOUSEHOLD_TYPE_LABEL,
  COOK_TIME_LABEL,
  MEAL_FORMAT_LABEL,
} from "@/lib/format";
import { safeNextPath } from "@/lib/safe-redirect";
import { saveOnboarding, type OnboardingInput } from "./actions";
import { Button } from "@/components/ui/button";
import { press, spring } from "@/lib/motion/tokens";

type Product = { id: string; name: string; imageEmoji: string };

const STEPS = ["Goal", "Household", "Budget & time", "Dietary notes", "Favorites", "Meal formats", "How you shop"];

const empty: OnboardingInput = { favoriteProductIds: [], mealFormatPreference: [] };

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: press.scale }}
      transition={spring.snappy}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        selected ? "bg-carbon text-white" : "border border-border"
      }`}
    >
      {children}
    </motion.button>
  );
}

function Radio({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-input border border-border p-3 text-sm has-[:checked]:bg-lavender">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function OnboardingFlow({
  products,
  next,
  initial,
}: {
  products: Product[];
  next: string;
  /** Starts from the customer's saved preferences, the same record Account edits. */
  initial?: OnboardingInput;
}) {
  const router = useRouter();
  const [[step, direction], setStepState] = useState<[number, 1 | -1]>([0, 1]);
  const goTo = (next: number) => setStepState([next, next > step ? 1 : -1]);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<OnboardingInput>(initial ?? empty);

  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const finish = (payload: OnboardingInput | null) =>
    startTransition(async () => {
      await saveOnboarding(payload);
      router.push(safeNextPath(next, "/"));
    });

  const toggle = (key: "favoriteProductIds" | "mealFormatPreference", id: string) =>
    set(key, data[key].includes(id) ? data[key].filter((x) => x !== id) : [...data[key], id]);

  const radioGroup = (
    name: string,
    field: "primaryGoal" | "householdType" | "weeklyBudgetBand" | "cookTimeAvailable" | "shoppingStyle",
    options: { value: string; label: string; hint?: string }[],
  ) =>
    options.map((o) => (
      <Radio
        key={o.value}
        name={name}
        label={o.label}
        hint={o.hint}
        checked={data[field] === o.value}
        onChange={() => set(field, o.value)}
      />
    ));

  return (
    <div className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface p-5">
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
          <div className="space-y-2">
            <p className="text-sm font-medium">What is your main goal right now?</p>
            {radioGroup(
              "goal",
              "primaryGoal",
              GOALS.map((g) => ({ value: g.slug, label: g.label, hint: g.description })),
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Who are you usually shopping for?</p>
            {radioGroup(
              "household",
              "householdType",
              Object.entries(HOUSEHOLD_TYPE_LABEL).map(([value, label]) => ({ value, label })),
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Rough weekly spend on produce</p>
              <div className="mt-2 space-y-1.5">
                {radioGroup(
                  "budget",
                  "weeklyBudgetBand",
                  BUDGET_BANDS.map((b) => ({ value: b.id, label: b.label })),
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Time to cook on a typical evening</p>
              <div className="mt-2 space-y-1.5">
                {radioGroup(
                  "cooktime",
                  "cookTimeAvailable",
                  Object.entries(COOK_TIME_LABEL).map(([value, label]) => ({ value, label })),
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Anything we should know?</p>
            <div className="flex flex-wrap gap-2">
              {["Vegetarian", "No restrictions"].map((tag) => (
                <Chip
                  key={tag}
                  selected={data.dietaryNotes === tag}
                  onClick={() => set("dietaryNotes", data.dietaryNotes === tag ? undefined : tag)}
                >
                  {tag}
                </Chip>
              ))}
            </div>
            <textarea
              rows={2}
              placeholder="Allergies or dislikes, in your own words"
              value={data.dietaryNotes && !["Vegetarian", "No restrictions"].includes(data.dietaryNotes) ? data.dietaryNotes : ""}
              onChange={(e) => set("dietaryNotes", e.target.value || undefined)}
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-sm font-medium">Pick a few favorites</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {products.map((p) => (
                <Chip key={p.id} selected={data.favoriteProductIds.includes(p.id)} onClick={() => toggle("favoriteProductIds", p.id)}>
                  {p.imageEmoji} {p.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="text-sm font-medium">Any meal formats you lean on? (optional)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(MEAL_FORMAT_LABEL).map(([value, label]) => (
                <Chip key={value} selected={data.mealFormatPreference.includes(value)} onClick={() => toggle("mealFormatPreference", value)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">How would you like to shop?</p>
            {radioGroup(
              "style",
              "shoppingStyle",
              Object.entries(SHOPPING_STYLE_LABEL).map(([value, label]) => ({ value, label })),
            )}
          </div>
        )}
      </motion.div>
      </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button onClick={() => finish(null)} disabled={isPending} className="text-sm text-muted underline">
          Skip for now
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" size="md" onClick={() => goTo(step - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="md" onClick={() => goTo(step + 1)}>
              Next
            </Button>
          ) : (
            <Button size="md" onClick={() => finish(data)} disabled={isPending}>
              {isPending ? "Saving…" : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
