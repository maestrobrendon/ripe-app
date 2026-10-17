"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Button } from "../../_ui/kit";
import { decidePlanRequest } from "../customers/actions";

/** Approve (payment is in) or decline a plan request, with the reason the customer will see. */
export function RequestDecision({ requestId }: { requestId: string }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (approve: boolean) => {
    const note = approve ? undefined : (window.prompt("Why is it declined? The customer sees this.") ?? "").trim();
    if (!approve && !note) return;
    start(async () => {
      setError(null);
      const r = await run(() => decidePlanRequest({ requestId, approve, note }));
      if (r.ok) router.refresh();
      else if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
    });
  };
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[12px] text-[#9a2c00]">{error}</span>}
      <Button size="sm" disabled={pending} onClick={() => decide(true)}>
        Payment received, approve
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide(false)}>
        Decline
      </Button>
    </div>
  );
}
