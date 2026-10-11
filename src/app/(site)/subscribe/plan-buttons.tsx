"use client";

import { useTransition } from "react";
import { changeTier, cancelSubscription } from "./actions";

/** For a current member: move to another plan in place. */
export function SwitchPlanButton({ slug, name, className }: { slug: string; name: string; className: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button type="button" disabled={isPending} onClick={() => startTransition(() => changeTier(slug))} className={`${className} disabled:opacity-60`}>
      {isPending ? "Switching…" : `Switch to ${name}`}
    </button>
  );
}

/** For a current member: back to paying as you go. */
export function CancelMembershipButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => cancelSubscription())}
      className="text-[14px] font-semibold text-[var(--hm-ink-2)] underline decoration-carbon/25 underline-offset-4 hover:text-carbon disabled:opacity-60"
    >
      {isPending ? "Cancelling…" : "Cancel membership"}
    </button>
  );
}
