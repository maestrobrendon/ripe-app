"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { changeTier, cancelSubscription, withdrawPlanRequest, type PlanResult } from "./actions";

const LINK = "text-[14px] font-semibold text-[var(--hm-ink-2)] underline decoration-carbon/25 underline-offset-4 hover:text-carbon disabled:opacity-60";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();
  /** `done`: what the pop-up says once it's gone through. */
  const run = (fn: () => Promise<PlanResult>, done: string, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn().catch(() => ({ ok: false as const, error: "That didn't go through. Check your connection and try again." }));
      if (!r.ok) return setError(r.error);
      after?.();
      cart.announce(done);
      router.refresh();
    });
  return { pending, error, run };
}

function Problem({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-2 text-[13px] text-ember">
      {error}
    </p>
  ) : null;
}

/** For a current member: move to another plan in place. */
export function SwitchPlanButton({ slug, name, className }: { slug: string; name: string; className: string }) {
  const { pending, error, run } = useRun();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => run(() => changeTier(slug), `You're on ${name} now`)} className={`${className} disabled:opacity-60`}>
        {pending ? "Switching…" : `Switch to ${name}`}
      </button>
      <Problem error={error} />
    </>
  );
}

/** For a current member: back to paying as you go, after a second tap. */
export function CancelMembershipButton() {
  const { pending, error, run } = useRun();
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <div className="flex flex-wrap items-center gap-3 text-[14px]">
        <span>Member prices end straight away. Cancel?</span>
        <button type="button" disabled={pending} onClick={() => run(cancelSubscription, "Membership cancelled. Your baskets are saved.", () => setAsking(false))} className="rounded-full bg-ember px-4 py-1.5 font-semibold text-carbon disabled:opacity-60">
          {pending ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button type="button" onClick={() => setAsking(false)} className={LINK}>
          Keep it
        </button>
        <Problem error={error} />
      </div>
    );
  return (
    <button type="button" onClick={() => setAsking(true)} className={LINK}>
      Cancel membership
    </button>
  );
}

/** For someone waiting on a plan request: take it back. */
export function WithdrawRequestButton() {
  const { pending, error, run } = useRun();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => run(withdrawPlanRequest, "Request withdrawn")} className={LINK}>
        {pending ? "Withdrawing…" : "Withdraw request"}
      </button>
      <Problem error={error} />
    </>
  );
}
