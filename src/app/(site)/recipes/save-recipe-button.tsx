"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
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
  inline = false,
}: {
  recipeId: string;
  initialSaved: boolean;
  signedIn: boolean;
  /** A labelled pill in the page's flow, instead of a heart over a card. */
  inline?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  const baseClass = inline
    ? "tap-target inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-[14px] font-semibold"
    : "tap-target absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/90 backdrop-blur-sm";

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
        {inline && "Save"}
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
        haptic(saved ? "selection" : "light");
        setSaved((s) => !s);
        startTransition(async () => {
          await toggleSavedRecipe(recipeId);
        });
      }}
      className={`${baseClass} disabled:opacity-60 ${saved ? "text-ember" : "text-muted hover:text-carbon"}`}
    >
      {/* A saved heart fills and pops; unsaving just settles back. */}
      <motion.span key={String(saved)} initial={saved ? { scale: 0.5 } : false} animate={{ scale: 1 }} transition={spring.juicy} className="inline-flex">
        <Icon name="favourite" size={16} weight={saved ? "fill" : "regular"} />
      </motion.span>
      {inline && <span className="text-carbon">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
