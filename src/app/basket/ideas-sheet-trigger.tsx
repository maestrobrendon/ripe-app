"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/components/ui/icon";
import { IdeasPanel } from "./ideas-panel";

/**
 * The mobile entry point to Ideas: a button that opens a bottom sheet with the
 * same suggestion content the desktop panel shows inline. Used from the basket
 * hub's status card and from the Recipes page, per the addendum.
 */
export function IdeasSheetTrigger({
  basketId,
  signature,
  locked = false,
  className,
  label = "Get ideas",
  icon = "reward",
}: {
  basketId?: string;
  signature?: string;
  locked?: boolean;
  className?: string;
  label?: React.ReactNode;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "tap-target inline-flex items-center gap-1.5 rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-carbon/85"
        }
      >
        <Icon name={icon} size={16} strokeWidth={2} />
        {label}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Ideas">
        <IdeasPanel basketId={basketId} signature={signature} locked={locked} onApplied={() => setOpen(false)} />
      </BottomSheet>
    </>
  );
}
