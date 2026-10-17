"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { SaveRecipeButton } from "./save-recipe-button";
import { RecipeSheet, type RecipeSheetData } from "./recipe-sheet";
import { SlotPickerSheet } from "./slot-picker-sheet";
import { setMealSlot } from "./meal-plan-actions";
import type { MealPlanDay, MealSlotKey } from "@/lib/meal-plan-types";

export type LibraryRecipe = RecipeSheetData;

/**
 * The "All recipes" grid: tapping a card opens the recipe sheet (one
 * consistent recipe experience across the app) instead of navigating to a
 * separate page. "Add to my timetable" hands off to the day/slot picker,
 * then lands the customer on the Meal Plan tab so they can see it landed.
 */
export function RecipeLibrary({
  recipes,
  isSubscriber,
  signedIn,
  savedRecipeIds,
}: {
  recipes: LibraryRecipe[];
  isSubscriber: boolean;
  signedIn: boolean;
  savedRecipeIds: Set<string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<RecipeSheetData | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const open = recipes.find((r) => r.id === openId) ?? null;

  const pick = (day: MealPlanDay, slot: MealSlotKey) => {
    if (!pickingFor) return;
    const recipeId = pickingFor.id;
    startTransition(async () => {
      await setMealSlot(0, day, slot, { kind: "recipe", recipeId });
      setPickingFor(null);
      setOpenId(null);
      router.push("/recipes?tab=planner");
    });
  };

  return (
    <>
      <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => {
          const steps = r.instructions.split("\n").filter(Boolean).length;
          const haveCount = r.ingredients.filter((i) => i.have).length;

          return (
            <li key={r.id} className="relative">
              <SaveRecipeButton recipeId={r.id} initialSaved={savedRecipeIds.has(r.id)} signedIn={signedIn} />
              <button type="button" onClick={() => setOpenId(r.id)} className="group block w-full text-left">
                <div className="flex items-center">
                  {r.ingredients.slice(0, 4).map((p, i) => (
                    <ProductImage
                      key={p.productId}
                      publicId={p.cloudinaryPublicId}
                      alt={p.name}
                      emoji={p.imageEmoji}
                      className={`h-16 w-16 ring-2 ring-paper-white transition group-hover:ring-sky-wash ${i > 0 ? "-ml-4" : ""}`}
                      rounded="rounded-full"
                      emojiClassName="text-2xl"
                      sizes="64px"
                    />
                  ))}
                  {r.ingredients.length > 4 && (
                    <span className="-ml-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-wash text-sm font-semibold text-carbon ring-2 ring-paper-white">
                      +{r.ingredients.length - 4}
                    </span>
                  )}
                </div>

                <h3 className="mt-5 text-lg font-bold group-hover:underline">{r.title}</h3>

                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                  <span>{r.ingredients.length} ingredients</span>
                  <span aria-hidden>·</span>
                  <span>{steps} {steps === 1 ? "step" : "steps"}</span>
                  {isSubscriber && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-medium text-carbon">You have {haveCount} of {r.ingredients.length}</span>
                    </>
                  )}
                </p>

                <p className="mt-3 text-base text-muted">{r.summary}</p>
              </button>

              <div className="mt-3">
                <Link href={`/recipes/${r.slug}`} className="text-sm font-semibold text-carbon underline">
                  Open full page
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <RecipeSheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        recipe={open}
        isSubscriber={isSubscriber}
        signedIn={signedIn}
        onAddToTimetable={isSubscriber ? (recipe) => setPickingFor(recipe) : undefined}
      />

      <SlotPickerSheet
        open={Boolean(pickingFor) && !isPending}
        onClose={() => setPickingFor(null)}
        mealName={pickingFor?.title ?? ""}
        onPick={pick}
      />
    </>
  );
}
