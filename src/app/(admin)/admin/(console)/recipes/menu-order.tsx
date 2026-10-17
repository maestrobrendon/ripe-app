"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card } from "../../_ui/kit";
import { reorderMenu } from "./actions";

/** The menu in order, with up/down to change it and one save. */
export function MenuOrder({ items, canReorder }: { items: { id: string; title: string; meta: string }[]; canReorder: boolean }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const dirty = order.join() !== items.map((i) => i.id).join();
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <Card
      title={`On the menu (${items.length})`}
      actions={
        dirty && canReorder ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await run(() => reorderMenu(order));
                if (r.ok) {
                  setNotice({ tone: "success", text: "Menu order saved." });
                  router.refresh();
                } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
              })
            }
          >
            Save order
          </Button>
        ) : undefined
      }
    >
      {notice && (
        <div className="mb-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      <ol className="space-y-1">
        {order.map((id, i) => {
          const r = byId.get(id)!;
          return (
            <li key={id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-soft-mist/40">
              <span className="w-6 text-right font-mono text-carbon/40 tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/recipes/${id}`} className="font-semibold hover:underline">
                  {r.title}
                </Link>
                <p className="text-[12px] text-carbon/55">{r.meta}</p>
              </div>
              {canReorder && (
                <span className="flex">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="h-8 w-8 rounded-lg hover:bg-soft-mist disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="h-8 w-8 rounded-lg hover:bg-soft-mist disabled:opacity-30">
                    ↓
                  </button>
                </span>
              )}
            </li>
          );
        })}
        {order.length === 0 && <li className="text-[13px] text-carbon/50">Nothing on the menu yet.</li>}
      </ol>
    </Card>
  );
}
