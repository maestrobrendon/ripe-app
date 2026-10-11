"use client";

import { useMemo, useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import type { MealPlanDay, MealSlotKey } from "@/lib/meal-plan-types";
import { MEAL_SLOT_LABEL } from "@/lib/meal-plan-types";
import { setMealSlot, addOwnMeal } from "./meal-plan-actions";
import type { MealOption, RecipeOption, SlotView } from "./weekly-meal-plan";

const COMMON_INGREDIENTS = ["Tomatoes", "Onions", "Pepper", "Plantain", "Rice", "Chicken", "Eggs", "Bread", "Beans", "Fish"];

/**
 * Search own meals and our recipes, or type any meal by name. Typing
 * something that matches nothing offers "Add as your own meal", which steps
 * into the ingredient picker before saving.
 */
export function AddMealSheet({
  open,
  onClose,
  day,
  slot,
  weekOffset,
  ownMealOptions,
  recipeOptions,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  day: MealPlanDay;
  slot: MealSlotKey;
  weekOffset: number;
  ownMealOptions: MealOption[];
  recipeOptions: RecipeOption[];
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [defining, setDefining] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const matchedOwn = ownMealOptions.filter((m) => !q || m.name.toLowerCase().includes(q));
  const matchedRecipes = recipeOptions.filter((r) => !q || r.title.toLowerCase().includes(q));
  const exact = [...ownMealOptions.map((m) => m.name), ...recipeOptions.map((r) => r.title)].some(
    (n) => n.toLowerCase() === q,
  );

  const close = () => {
    setQuery("");
    setDefining(null);
    onClose();
  };

  const pickOwn = (ownMealId: string) =>
    startTransition(async () => {
      await setMealSlot(weekOffset, day, slot, { kind: "own", ownMealId });
      close();
      onDone();
    });

  const pickRecipe = (recipeId: string) =>
    startTransition(async () => {
      await setMealSlot(weekOffset, day, slot, { kind: "recipe", recipeId });
      close();
      onDone();
    });

  if (defining !== null) {
    return (
      <NewMealSheet
        open={open}
        name={defining}
        onBack={() => setDefining(null)}
        onSaved={(ownMealId) => pickOwn(ownMealId)}
      />
    );
  }

  return (
    <BottomSheet open={open} onClose={close} title={`Add ${MEAL_SLOT_LABEL[slot].toLowerCase()} for ${day.slice(0, 1)}${day.slice(1, 3).toLowerCase()}`}>
      <p className="text-sm text-muted">Type any meal, or pick one below.</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Like jollof rice, or bread and tea"
        autoComplete="off"
        className="mt-3 h-13 w-full rounded-input border border-border px-3.5 text-base outline-none focus:border-carbon"
      />

      <div className="mt-4 space-y-4">
        {q && !exact && (
          <button
            disabled={isPending}
            onClick={() => setDefining(query.trim())}
            className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
              <Icon name="plus" size={16} />
            </span>
            <span>
              <span className="block font-semibold">Add &ldquo;{query.trim()}&rdquo;</span>
              <span className="block text-sm text-muted">As your own meal</span>
            </span>
          </button>
        )}

        {matchedOwn.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your meals</p>
            <div className="space-y-2">
              {matchedOwn.map((m) => (
                <button
                  key={m.id}
                  disabled={isPending}
                  onClick={() => pickOwn(m.id)}
                  className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left disabled:opacity-60"
                >
                  <span className="text-xl">🍽️</span>
                  <span>
                    <span className="block font-semibold">{m.name}</span>
                    <span className="block text-sm text-muted">{m.ingredientCount} things</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {matchedRecipes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Our recipes</p>
            <div className="space-y-2">
              {matchedRecipes.map((r) => (
                <button
                  key={r.id}
                  disabled={isPending}
                  onClick={() => pickRecipe(r.id)}
                  className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left disabled:opacity-60"
                >
                  <Icon name="recipes" size={20} />
                  <span>
                    <span className="block font-semibold">{r.title}</span>
                    <span className="block text-sm text-muted">Everything is on our shelves</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function NewMealSheet({
  open,
  name,
  onBack,
  onSaved,
}: {
  open: boolean;
  name: string;
  onBack: () => void;
  onSaved: (ownMealId: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [isPending, startTransition] = useTransition();

  const toggle = (item: string) =>
    setPicked((p) => (p.includes(item) ? p.filter((x) => x !== item) : [...p, item]));

  const addExtra = () => {
    const v = extra.trim();
    if (!v) return;
    setPicked((p) => [...p, v]);
    setExtra("");
  };

  const save = () =>
    startTransition(async () => {
      const { id } = await addOwnMeal(name, picked);
      onSaved(id);
    });

  return (
    <BottomSheet open={open} onClose={onBack} title="What goes into it?">
      <p className="text-sm text-muted">{name}. This is optional. It fills your shopping list.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {COMMON_INGREDIENTS.map((c) => (
          <button
            key={c}
            onClick={() => toggle(c)}
            aria-pressed={picked.includes(c)}
            className={`rounded-full px-3.5 py-2 text-sm font-medium ${
              picked.includes(c) ? "bg-carbon text-white" : "bg-soft-mist"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addExtra();
            }
          }}
          placeholder="Add something else, then press enter"
          className="h-11 min-w-0 flex-1 rounded-input border border-border px-3.5 text-sm outline-none focus:border-carbon"
        />
      </div>

      {picked.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {picked.map((p, i) => (
            <li key={`${p}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
              <span>{p}</span>
              <button onClick={() => setPicked((list) => list.filter((_, idx) => idx !== i))} className="text-muted hover:text-foreground">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        disabled={isPending}
        onClick={save}
        className="tap-target mt-5 w-full rounded-full bg-carbon py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        Save meal
      </button>
    </BottomSheet>
  );
}

/** What a filled slot opens: view the recipe, swap it for something else, or clear it. */
export function MealMenuSheet({
  open,
  onClose,
  slot,
  onViewRecipe,
  onChange,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  slot: SlotView | null | undefined;
  onViewRecipe: (recipeId: string) => void;
  onChange: () => void;
  onRemove: () => void;
}) {
  const ownIngredients = useMemo(() => (slot?.kind === "own" ? slot.ingredientLines : []), [slot]);
  if (!slot) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={slot.title}>
      {ownIngredients.length > 0 && (
        <div className="mb-4 divide-y divide-border">
          {ownIngredients.map((g, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
              <span>{g.label}</span>
              <em className={`text-xs font-semibold not-italic ${g.weSell ? "text-carbon" : "text-muted"}`}>
                {g.weSell ? "We sell this" : "Get elsewhere"}
              </em>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {slot.kind === "recipe" && (
          <button
            onClick={() => onViewRecipe(slot.refId)}
            className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left"
          >
            <span className="text-xl" aria-hidden>📖</span>
            <span className="font-semibold">See the recipe</span>
          </button>
        )}
        <button onClick={onChange} className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left">
          <Icon name="recurring" size={18} />
          <span className="font-semibold">Change this meal</span>
        </button>
        <button onClick={onRemove} className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left text-ember">
          <Icon name="close" size={18} />
          <span className="font-semibold">Remove this meal</span>
        </button>
      </div>
    </BottomSheet>
  );
}
