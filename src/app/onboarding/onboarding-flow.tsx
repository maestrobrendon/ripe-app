"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

type Product = { id: string; name: string; imageEmoji: string };

const STEPS = ["Goal", "Household", "Budget & time", "Dietary notes", "Favorites", "Meal formats", "How you shop"];

const empty: OnboardingInput = { favoriteProductIds: [], mealFormatPreference: [] };

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
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-ripe-green has-[:checked]:bg-ripe-green-light">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function OnboardingFlow({ products, next }: { products: Product[]; next: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<OnboardingInput>(empty);

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

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
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
                <button
                  key={tag}
                  onClick={() => set("dietaryNotes", data.dietaryNotes === tag ? undefined : tag)}
                  className={`rounded-full px-3 py-1 ${data.dietaryNotes === tag ? "bg-ripe-green text-white" : "border border-border"}`}
                >
                  {tag}
                </button>
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
                <button
                  key={p.id}
                  onClick={() => toggle("favoriteProductIds", p.id)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    data.favoriteProductIds.includes(p.id) ? "bg-ripe-green text-white" : "border border-border"
                  }`}
                >
                  {p.imageEmoji} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="text-sm font-medium">Any meal formats you lean on? (optional)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(MEAL_FORMAT_LABEL).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => toggle("mealFormatPreference", value)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    data.mealFormatPreference.includes(value) ? "bg-ripe-green text-white" : "border border-border"
                  }`}
                >
                  {label}
                </button>
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
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button onClick={() => finish(null)} disabled={isPending} className="text-sm text-muted underline">
          Skip for now
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-full border border-border px-5 py-2 text-sm font-medium"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full bg-ripe-green px-5 py-2 text-sm font-medium text-white hover:bg-ripe-green-dark"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => finish(data)}
              disabled={isPending}
              className="rounded-full bg-ripe-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-ripe-terracotta-dark disabled:opacity-60"
            >
              {isPending ? "Saving." : "Finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
