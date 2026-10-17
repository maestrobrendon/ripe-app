"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/guard";
import type { OrderStatus } from "@/generated/prisma/enums";
import { useAdminAction } from "../../step-up";
import { Alert, Button, Card, Field, Input } from "../../../_ui/kit";
import { addOrderComment, recordRefund, revealOrderContact, saveInternalNote, setOrderStatus } from "../actions";

type Notice = { tone: "error" | "success"; text: string } | null;

/** Runs an action through the step-up runner and reports the outcome. */
function useRun() {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const go = <T,>(fn: () => Promise<ActionResult<T>>, ok: string, then?: (d: T) => void) =>
    start(async () => {
      setNotice(null);
      const r = await run(fn);
      if (r.ok) {
        setNotice({ tone: "success", text: ok });
        then?.(r.data);
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });
  return { go, pending, notice };
}

export function OrderActions(props: {
  orderId: string;
  version: number;
  moves: { to: OrderStatus; label: string }[];
  canCancel: boolean;
  canRefund: boolean;
  leftToRefund: number;
}) {
  const { go, pending, notice } = useRun();
  const [mode, setMode] = useState<"none" | "cancel" | "refund">("none");
  if (props.moves.length === 0 && !props.canCancel && !props.canRefund) return notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null;

  return (
    <Card title="Next step">
      {notice && (
        <div className="mb-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {props.moves.map((m, i) => (
          <Button
            key={m.to}
            size="sm"
            variant={i === 0 ? "primary" : "secondary"}
            disabled={pending}
            onClick={() => go(() => setOrderStatus({ orderId: props.orderId, to: m.to, version: props.version }), `Marked ${m.label.toLowerCase()}.`)}
          >
            Mark {m.label.toLowerCase()}
          </Button>
        ))}
        {props.canCancel && (
          <Button size="sm" variant="ghost" className="text-[#9a2c00]" disabled={pending} onClick={() => setMode(mode === "cancel" ? "none" : "cancel")}>
            Cancel order
          </Button>
        )}
        {props.canRefund && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode(mode === "refund" ? "none" : "refund")}>
            Record a refund
          </Button>
        )}
      </div>

      {mode === "cancel" && (
        <form
          className="mt-4 space-y-3 border-t border-black/6 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const note = String(new FormData(e.currentTarget).get("reason") ?? "");
            go(() => setOrderStatus({ orderId: props.orderId, to: "CANCELLED", version: props.version, note }), "Order cancelled. The customer has been emailed.", () => setMode("none"));
          }}
        >
          <Field label="Why is it cancelled?" htmlFor="cancel-reason" hint="The customer sees this in their email and on their order page.">
            <Input id="cancel-reason" name="reason" required maxLength={500} placeholder="e.g. Out of stock on several items; we'll refund you in full" />
          </Field>
          <Button type="submit" size="sm" variant="danger" disabled={pending}>
            Cancel the order
          </Button>
        </form>
      )}

      {mode === "refund" && (
        <form
          className="mt-4 grid gap-3 border-t border-black/6 pt-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            go(
              () =>
                recordRefund({
                  orderId: props.orderId,
                  version: props.version,
                  amount: Math.round(Number(f.get("amount"))),
                  method: String(f.get("method") ?? ""),
                  reason: String(f.get("reason") ?? ""),
                }),
              "Refund recorded and the customer emailed.",
              () => setMode("none"),
            );
          }}
        >
          <Field label="Amount (₦)" htmlFor="refund-amount" hint={`Up to ₦${props.leftToRefund.toLocaleString("en-NG")}`}>
            <Input id="refund-amount" name="amount" type="number" inputMode="numeric" min={1} max={props.leftToRefund} required defaultValue={props.leftToRefund} />
          </Field>
          <Field label="Paid back by" htmlFor="refund-method">
            <Input id="refund-method" name="method" required maxLength={80} placeholder="Bank transfer, ref 1234" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Reason" htmlFor="refund-reason">
              <Input id="refund-reason" name="reason" required maxLength={500} placeholder="e.g. Two items missing" />
            </Field>
          </div>
          <p className="text-[12px] text-carbon/55 sm:col-span-2">
            This records money you have already sent back. There&apos;s no payment gateway yet, so nothing is paid out from here.
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              Record refund
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function RevealContact({ orderId, maskedPhone, maskedEmail, canReveal }: { orderId: string; maskedPhone: string; maskedEmail: string; canReveal: boolean }) {
  const { go, pending, notice } = useRun();
  const [shown, setShown] = useState<{ phone: string; email: string | null } | null>(null);
  return (
    <div className="mt-1 text-[13px]">
      <p className="tabular-nums">{shown ? shown.phone : maskedPhone}</p>
      <p>{shown ? (shown.email ?? "No email") : maskedEmail}</p>
      {canReveal && !shown && (
        <button
          type="button"
          disabled={pending}
          className="mt-1.5 text-[12px] font-semibold text-carbon/60 underline underline-offset-2 hover:text-carbon"
          onClick={() => go(() => revealOrderContact(orderId), "Shown and recorded in the audit log.", setShown)}
        >
          Show full contact details
        </button>
      )}
      {notice?.tone === "error" && <p className="mt-1 text-[12px] text-[#9a2c00]">{notice.text}</p>}
    </div>
  );
}

export function OrderNotes({ orderId, note, canEdit }: { orderId: string; note: string; canEdit: boolean }) {
  const { go, pending, notice } = useRun();
  const [value, setValue] = useState(note);
  const [comment, setComment] = useState("");
  return (
    <Card title="Staff notes">
      <p className="mb-2 text-[12px] text-carbon/55">Never shown to the customer.</p>
      {canEdit ? (
        <>
          <textarea
            aria-label="Staff note"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded-xl bg-paper-white p-3 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]"
          />
          <Button size="sm" variant="secondary" className="mt-2" disabled={pending || value === note} onClick={() => go(() => saveInternalNote({ orderId, note: value }), "Note saved.")}>
            Save note
          </Button>
          <form
            className="mt-4 flex gap-2 border-t border-black/6 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              go(() => addOrderComment({ orderId, note: comment }), "Added to the timeline.", () => setComment(""));
            }}
          >
            <Input aria-label="Add to timeline" placeholder="Add to the timeline…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} className="h-9! text-[13px]!" />
            <Button size="sm" variant="secondary" disabled={pending || !comment.trim()}>
              Add
            </Button>
          </form>
        </>
      ) : (
        <p className="text-[13px] whitespace-pre-line text-carbon/75">{note || "No notes."}</p>
      )}
      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Card>
  );
}
