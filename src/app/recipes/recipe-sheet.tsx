"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { sendRecipeIngredientsToBasket, sendRecipeIngredientsToCart } from "./meal-plan-actions";

export type RecipeSheetData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  instructions: string;
  ingredients: {
    productId: string;
    name: string;
    imageEmoji: string;
    cloudinaryPublicId: string | null;
    price: number;
    have: boolean;
  }[];
};

/**
 * The one recipe sheet, opened from a tap anywhere a recipe shows up: the
 * All recipes grid or the Meal Plan tab's "See the recipe". "Get the ones
 * I'm missing" goes to the basket for a subscriber (diffed against what's
 * already there) or the cart for a free account (every ingredient, since a
 * free account has no recurring basket to diff against). "Add to my
 * timetable" is subscriber-only and handed back to the caller, which opens
 * the day/slot picker next — recipe sheet and slot picker never nest.
 */
export function RecipeSheet({
  open,
  onClose,
  recipe,
  isSubscriber,
  signedIn,
  onAddToTimetable,
}: {
  open: boolean;
  onClose: () => void;
  recipe: RecipeSheetData | null;
  isSubscriber: boolean;
  signedIn: boolean;
  onAddToTimetable?: (recipe: RecipeSheetData) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!recipe) return null;

  const missing = recipe.ingredients.filter((i) => !i.have);
  const missingCost = missing.reduce((sum, i) => sum + i.price, 0);
  const steps = recipe.instructions.split("\n").filter(Boolean);

  const getMissing = () =>
    startTransition(async () => {
      if (isSubscriber) await sendRecipeIngredientsToBasket(recipe.id);
      else await sendRecipeIngredientsToCart(recipe.id);
      router.refresh();
    });

  return (
    <BottomSheet open={open} onClose={onClose} title={recipe.title}>
      <p className="text-sm text-muted">{recipe.summary}</p>

      <h5 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">You need</h5>
      <div className="mt-2 divide-y divide-border">
        {recipe.ingredients.map((i) => (
          <div key={i.productId} className="flex items-center gap-3 py-2.5">
            <ProductImage
              publicId={i.cloudinaryPublicId}
              alt={i.name}
              emoji={i.imageEmoji}
              className="h-10 w-10 shrink-0"
              rounded="rounded-xl"
              emojiClassName="text-xl"
              sizes="40px"
            />
            <span className="flex-1 text-sm font-medium">{i.name}</span>
            {i.have ? (
              <span className="text-xs font-semibold text-carbon">You have this</span>
            ) : (
              <span className="text-sm text-muted">{formatNaira(i.price)}</span>
            )}
          </div>
        ))}
      </div>

      <h5 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">How to make it</h5>
      <ol className="mt-2 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-soft-mist text-xs font-semibold">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-2">
        {signedIn &&
          (missing.length > 0 ? (
            <button
              disabled={isPending}
              onClick={getMissing}
              className="tap-target w-full rounded-full bg-carbon py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSubscriber
                ? `Get the ${missing.length} I'm missing, ${formatNaira(missingCost)}`
                : "Add ingredients to cart"}
            </button>
          ) : (
            isSubscriber && (
              <p className="flex items-center justify-center gap-2 rounded-full bg-mint-pop/25 py-3 text-sm font-semibold text-carbon">
                <Icon name="check" size={16} />
                You have everything
              </p>
            )
          ))}

        {isSubscriber && onAddToTimetable && (
          <button
            onClick={() => onAddToTimetable(recipe)}
            className="tap-target w-full rounded-full bg-soft-mist py-3 text-sm font-semibold text-carbon"
          >
            Add to my timetable
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
