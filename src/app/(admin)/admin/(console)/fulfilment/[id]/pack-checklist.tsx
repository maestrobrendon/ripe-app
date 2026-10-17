"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/generated/prisma/enums";
import { useAdminAction } from "../../step-up";
import { Alert, Button, cx } from "../../../_ui/kit";
import { packOrder, startPicking } from "../actions";

type Item = { id: string; name: string; emoji: string; quantity: string };
type Mark = "packed" | "short";

/**
 * Tap each item as it goes in the bag. An item that isn't there gets marked
 * short (with a word on why); the order can still be packed, and the
 * shortage lands on its timeline for support to follow up.
 */
export function PackChecklist({ orderId, version, status, items, canPack }: { orderId: string; version: number; status: OrderStatus; items: Item[]; canPack: boolean }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string, mark: Mark) =>
    setMarks((x) => {
      const next = { ...x };
      if (next[id] === mark) delete next[id];
      else next[id] = mark;
      return next;
    });
  const done = items.filter((i) => marks[i.id]).length;
  const short = items.filter((i) => marks[i.id] === "short");
  const packable = status === "CONFIRMED" || status === "PICKING";

  if (!packable) {
    return (
      <div className="mt-6 space-y-3">
        <Alert tone={status === "PACKED" ? "success" : "info"}>
          {status === "RECEIVED" ? "This order hasn't been confirmed yet." : status === "PACKED" ? "Packed. It's ready for a delivery run." : "This order is past packing."}
        </Alert>
        <ul className="divide-y divide-black/5 rounded-2xl bg-paper-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-4 py-3 text-[15px]">
              <span>
                {i.emoji} {i.name}
              </span>
              <b className="tabular-nums">{i.quantity}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await run(() => packOrder({ orderId, version, short: short.map((i) => ({ name: i.name, note: notes[i.id] ?? "" })) }));
      if (r.ok) router.refresh();
      else if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
    });

  return (
    <div className="mt-6 space-y-4 pb-28">
      {status === "CONFIRMED" && canPack && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await run(() => startPicking({ orderId, version }));
              if (r.ok) router.refresh();
              else if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
            })
          }
        >
          Start packing this order
        </Button>
      )}
      <ul className="space-y-2">
        {items.map((i) => {
          const m = marks[i.id];
          return (
            <li key={i.id} className={cx("rounded-2xl bg-paper-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]", m === "packed" && "bg-mint-pop/20", m === "short" && "bg-ember/10")}>
              <button
                type="button"
                disabled={!canPack}
                onClick={() => toggle(i.id, "packed")}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-[15px] font-bold", m === "packed" ? "border-carbon bg-carbon text-paper-white" : "border-carbon/40")}>
                  {m === "packed" ? "✓" : ""}
                </span>
                <span className="flex-1 text-[16px] leading-tight">
                  {i.emoji} {i.name}
                </span>
                <b className="text-[18px] tabular-nums">{i.quantity}</b>
              </button>
              {canPack && (
                <div className="flex items-center gap-2 px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => toggle(i.id, "short")}
                    className={cx("h-8 rounded-lg px-3 text-[12px] font-semibold", m === "short" ? "bg-ember text-paper-white" : "text-carbon/60 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]")}
                  >
                    {m === "short" ? "Short" : "Mark short"}
                  </button>
                  {m === "short" && (
                    <input
                      aria-label={`Why is ${i.name} short?`}
                      placeholder="e.g. only 2 of 3, none at market"
                      maxLength={200}
                      value={notes[i.id] ?? ""}
                      onChange={(e) => setNotes((x) => ({ ...x, [i.id]: e.target.value }))}
                      className="h-8 flex-1 rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none"
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <Alert tone="error">{error}</Alert>}
      {canPack && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/6 bg-paper-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <p className="text-[14px] tabular-nums">
              {done} of {items.length}
              {short.length > 0 && <span className="text-[#9a2c00]"> · {short.length} short</span>}
            </p>
            <Button className="flex-1" disabled={pending || done < items.length} onClick={submit}>
              {pending ? "Saving…" : short.length ? "Packed, with shortages" : "Mark packed"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
