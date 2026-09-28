"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { toggleSavedRecipe } from "./actions";

/**
 * Sits as a sibling of the card's <Link>, absolutely positioned over it,
 * rather than nested inside it — a <button> inside an <a> would fire both
 * the toggle and the navigation on every tap.
 */
export function SaveRecipeButton({
  recipeId,
  initialSaved,
  signedIn,
}: {
  recipeId: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  const baseClass =
    "tap-target absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/90 backdrop-blur-sm";

  if (!signedIn) {
    // Visibly present, not absent: a guest sees saving exists, just gated,
    // rather than wondering why other users' cards look different.
    return (
      <Link
        href="/start"
        aria-label="Create an account to save recipes"
        title="Create an account to save recipes"
        className={`${baseClass} text-muted`}
      >
        <Icon name="favourite" size={16} strokeWidth={1.75} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved recipes" : "Save this recipe"}
      onClick={() => {
        setSaved((s) => !s);
        startTransition(async () => {
          await toggleSavedRecipe(recipeId);
        });
      }}
      className={`${baseClass} disabled:opacity-60 ${saved ? "text-ember" : "text-muted hover:text-carbon"}`}
    >
      <Icon name="favourite" size={16} strokeWidth={1.75} className={saved ? "fill-current" : undefined} />
    </button>
  );
}
