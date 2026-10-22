"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { sendRecipeIngredientsToOrder } from "./meal-plan-actions";
import { useCart } from "@/components/cart-provider";

export type RecipeSheetData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  instructions: string;
  /** A members-only recipe seen by someone who isn't one: the method stays off the page. */
  methodLocked?: boolean;
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
 * All recipes grid or the Meal Plan tab's "See the recipe". "Add the N you
 * don't have" adds what this week's order is missing. "Add to my meal plan"
 * is for members and handed back to the caller, which opens the day/slot
 * picker next — recipe sheet and slot picker never nest.
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
  const cart = useCart();

  if (!recipe) return null;

  const missing = recipe.ingredients.filter((i) => !i.have);
  const missingCost = missing.reduce((sum, i) => sum + i.price, 0);
  const steps = recipe.instructions.split("\n").filter(Boolean);

  const getMissing = () =>
    startTransition(async () => {
      await sendRecipeIngredientsToOrder(recipe.id);
      cart.announce(`Added ${missing.length} to ${cart.deliveryLabel ?? "your order"}`);
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
      {recipe.methodLocked && (
        <p className="mt-2 rounded-xl bg-soft-mist p-3 text-sm">
          The method for this one is for members.{" "}
          <Link href="/subscribe" className="font-semibold underline underline-offset-2">
            See membership
          </Link>
        </p>
      )}
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
              {isPending ? "Adding…" : `Add the ${missing.length} you don't have · ${formatNaira(missingCost)}`}
            </button>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-full bg-mint-pop/25 py-3 text-sm font-semibold text-carbon">
              <Icon name="check" size={16} />
              It&apos;s all in your order
            </p>
          ))}

        {isSubscriber && onAddToTimetable && (
          <button
            onClick={() => onAddToTimetable(recipe)}
            className="tap-target w-full rounded-full bg-soft-mist py-3 text-sm font-semibold text-carbon"
          >
            Add to my meal plan
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
