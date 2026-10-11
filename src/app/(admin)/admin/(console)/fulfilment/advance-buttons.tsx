"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Alert, Button } from "../../_ui/kit";
import { advanceDay } from "./actions";

/** Bulk moves for the day: confirm everything received, then start picking everything confirmed. */
export function AdvanceButtons(props: { day: string; received: number; confirmed: number; canConfirm: boolean; canPick: boolean }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "warn"; text: string } | null>(null);
  const go = (from: "RECEIVED" | "CONFIRMED", to: "CONFIRMED" | "PICKING", what: string) =>
    start(async () => {
      setNotice(null);
      const r = await run(() => advanceDay({ day: props.day, from, to }));
      if (!r.ok) {
        if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
        return;
      }
      setNotice(
        r.data.failed.length
          ? { tone: "warn", text: `${r.data.moved} ${what}. Not moved: ${r.data.failed.slice(0, 3).join("; ")}${r.data.failed.length > 3 ? "…" : ""}` }
          : { tone: "success", text: `${r.data.moved} order${r.data.moved === 1 ? "" : "s"} ${what}.` },
      );
      router.refresh();
    });
  if (!(props.canConfirm && props.received) && !(props.canPick && props.confirmed)) return notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null;
  return (
    <div className="mb-5 space-y-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        {props.canConfirm && props.received > 0 && (
          <Button size="sm" disabled={pending} onClick={() => go("RECEIVED", "CONFIRMED", "confirmed")}>
            Confirm {props.received} received order{props.received === 1 ? "" : "s"}
          </Button>
        )}
        {props.canPick && props.confirmed > 0 && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("CONFIRMED", "PICKING", "moved to picking")}>
            Start picking {props.confirmed} confirmed order{props.confirmed === 1 ? "" : "s"}
          </Button>
        )}
      </div>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
    </div>
  );
}
