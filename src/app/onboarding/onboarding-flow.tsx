"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GOALS } from "@/lib/assistant";
import { SHOPPING_STYLE_LABEL } from "@/lib/format";
import { saveOnboarding, type OnboardingInput } from "./actions";

type Product = { id: string; name: string; imageEmoji: string };

const STEPS = ["Goal", "Household", "Dietary notes", "Favorites", "How you shop"];

export function OnboardingFlow({ products, next }: { products: Product[]; next: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<OnboardingInput>({ favoriteProductIds: [] });

  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const finish = (payload: OnboardingInput | null) =>
    startTransition(async () => {
      await saveOnboarding(payload);
      router.push(next);
    });

  const toggleFav = (id: string) =>
    set(
      "favoriteProductIds",
      data.favoriteProductIds.includes(id)
        ? data.favoriteProductIds.filter((x) => x !== id)
        : [...data.favoriteProductIds, id],
    );

  return (
    <div className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        {step === 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">What is your main goal right now?</p>
            {GOALS.map((g) => (
              <label key={g.slug} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-ripe-green has-[:checked]:bg-ripe-green-light">
                <input
                  type="radio"
                  name="goal"
                  checked={data.primaryGoal === g.slug}
                  onChange={() => set("primaryGoal", g.slug)}
                />
                <span>
                  <span className="font-medium">{g.label}</span>
                  <span className="block text-xs text-muted">{g.description}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {step === 1 && (
          <label className="block text-sm">
            <span className="font-medium">How many people are you usually shopping for?</span>
            <input
              type="number"
              min={1}
              value={data.householdSize ?? ""}
              onChange={(e) => set("householdSize", Number(e.target.value) || undefined)}
              className="mt-2 w-24 rounded-lg border border-border px-3 py-2"
            />
          </label>
        )}

        {step === 2 && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Anything we should know?</p>
            <div className="flex flex-wrap gap-2">
              {["Vegetarian", "No restrictions"].map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    set("dietaryNotes", data.dietaryNotes === tag ? undefined : tag)
                  }
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

        {step === 3 && (
          <div>
            <p className="text-sm font-medium">Pick a few favorites</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleFav(p.id)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    data.favoriteProductIds.includes(p.id)
                      ? "bg-ripe-green text-white"
                      : "border border-border"
                  }`}
                >
                  {p.imageEmoji} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">How would you like to shop?</p>
            {Object.entries(SHOPPING_STYLE_LABEL).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-ripe-green has-[:checked]:bg-ripe-green-light">
                <input
                  type="radio"
                  name="style"
                  checked={data.shoppingStyle === value}
                  onChange={() => set("shoppingStyle", value)}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={() => finish(null)}
          disabled={isPending}
          className="text-sm text-muted underline"
        >
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
