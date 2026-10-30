"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TypeToConfirm } from "@/components/ui/type-to-confirm";
import { useCart } from "@/components/cart-provider";
import { ISSUE_KINDS, type IssueKind } from "@/lib/order-copy";
import { cancelOrder, orderAgain } from "@/app/(site)/basket/actions";
import { reportIssue } from "../actions";

/** What the customer can still do about an order: cancel before cutoff, order again, report a problem, get help. */
export function OrderControls(props: {
  orderId: string;
  ref_: string;
  canCancel: boolean;
  canReport: boolean;
  openReport: boolean;
  canOrderAgain: boolean;
  activeDeliveryId: string | null;
  activeHasItems: boolean;
  itemNames: string[];
  helpHref: string;
}) {
  const cart = useCart();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "cancel" | "again">(null);
  const [reportOpen, setReportOpen] = useState(props.openReport);
  const [kind, setKind] = useState<IssueKind | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cancel = () =>
    start(async () => {
      const r = await cancelOrder(props.orderId);
      setConfirm(null);
      if (!r.ok) return cart.announce(r.error, "error");
      cart.announce(`Order ${props.ref_} cancelled. Your items are back on Home.`);
      router.refresh();
    });

  const again = () =>
    start(async () => {
      if (!props.activeDeliveryId) return;
      const r = await orderAgain(props.activeDeliveryId, props.orderId);
      setConfirm(null);
      if (!r.ok) return cart.announce(r.error, "error");
      router.push("/basket?toast=again");
    });

  const send = () =>
    start(async () => {
      setError(null);
      if (!kind) return setError("Pick what went wrong.");
      const r = await reportIssue({ orderId: props.orderId, kind, items: picked, note });
      if (!r.ok) return setError(r.error);
      setReportOpen(false);
      cart.announce("Thanks for telling us. We'll message you shortly to put it right.");
      router.refresh();
    });

  const needsItems = kind === "missing" || kind === "damaged" || kind === "wrong" || kind === "quality";

  return (
    <div className="mt-5">
      {confirm === "cancel" ? (
        <div className="rounded-2xl bg-soft-mist p-4 text-sm">
          <p className="mb-3">Cancel this order? Your items go back to Home, so you can change them and confirm again. If you paid online, the money goes back the way you paid.</p>
          <TypeToConfirm phrase="Cancel order">
            {(ready) => (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={pending} disabled={!ready} onClick={cancel}>
                  Cancel order
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                  Keep it
                </Button>
              </div>
            )}
          </TypeToConfirm>
        </div>
      ) : confirm === "again" ? (
        <div className="rounded-2xl bg-soft-mist p-4 text-sm">
          <p>Put these items in your next order? They replace what&apos;s there now.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" loading={pending} onClick={again}>
              Yes, replace
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {props.canCancel && (
            <Button size="sm" variant="secondary" onClick={() => setConfirm("cancel")}>
              Cancel order
            </Button>
          )}
          {props.canReport && (
            <Button size="sm" variant="secondary" onClick={() => setReportOpen(true)}>
              Something wrong?
            </Button>
          )}
          {props.canOrderAgain && props.activeDeliveryId && (
            <Button size="sm" variant="secondary" loading={pending && !confirm} onClick={() => (props.activeHasItems ? setConfirm("again") : again())}>
              Order these again
            </Button>
          )}
          <a href={props.helpHref} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold ring-1 ring-hairline transition-colors hover:bg-black/[0.03]">
            Get help
          </a>
        </div>
      )}

      <BottomSheet open={reportOpen} onClose={() => setReportOpen(false)} title="What went wrong?">
        <div className="flex flex-wrap gap-2" role="group" aria-label="What went wrong">
          {ISSUE_KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className={`rounded-full border px-3 py-1.5 text-sm ${kind === k.id ? "border-carbon bg-carbon text-paper-white" : "border-hairline"}`}>
              {k.label}
            </button>
          ))}
        </div>

        {needsItems && (
          <>
            <p className="mt-4 text-sm font-medium">Which items?</p>
            <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto">
              {props.itemNames.map((n) => (
                <label key={n} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-soft-mist">
                  <input type="checkbox" className="size-4 accent-carbon" checked={picked.includes(n)} onChange={(e) => setPicked(e.target.checked ? [...picked, n] : picked.filter((x) => x !== n))} />
                  <span className="text-sm">{n}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <label className="mt-4 block text-sm font-medium" htmlFor="issue-note">
          Anything else? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="issue-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="mt-1.5 w-full rounded-control border border-hairline bg-surface px-4 py-3 text-base outline-none focus:border-carbon" placeholder="The pawpaw was soft on one side." />

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-ember/12 p-3 text-sm">
            {error}
          </p>
        )}
        <Button size="lg" className="mt-4 w-full" loading={pending} onClick={send}>
          Send
        </Button>
        <p className="mt-2 text-center text-xs text-muted">We usually put it right with a credit or a replacement on your next delivery.</p>
      </BottomSheet>
    </div>
  );
}
