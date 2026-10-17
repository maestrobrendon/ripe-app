"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/guard";
import type { DeliveryRunStatus, OrderStatus } from "@/generated/prisma/enums";
import { useAdminAction } from "../../../step-up";
import { Alert, Badge, Button, Card, cx } from "../../../../_ui/kit";
import { deleteRun, setRunRider, setStops, settleStop, startRun } from "../../actions";

type Stop = { id: string; ref: string; version: number; status: OrderStatus; statusLabel: string; customer: string; zone: string; address: string };
const selectClass = "h-9 rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

export function RunControls(props: {
  run: { id: string; status: DeliveryRunStatus; riderId: string | null };
  riders: { id: string; name: string }[];
  stops: Stop[];
  canPlan: boolean;
  canSettle: boolean;
}) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [order, setOrder] = useState(props.stops.map((s) => s.id));
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const planning = props.run.status === "PLANNING";
  const byId = new Map(props.stops.map((s) => [s.id, s]));
  const dirty = order.join() !== props.stops.map((s) => s.id).join();

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

  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-5">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            Rider
            <select
              className={selectClass}
              disabled={!props.canPlan || pending}
              defaultValue={props.run.riderId ?? ""}
              onChange={(e) => go(() => setRunRider({ runId: props.run.id, riderId: e.target.value || null }), "Rider set.")}
            >
              <option value="">None yet</option>
              {props.riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <span className="flex-1" />
          {planning && props.canPlan && (
            <>
              {dirty && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => go(() => setStops({ runId: props.run.id, orderIds: order }), "Stops saved.")}>
                  Save stop order
                </Button>
              )}
              <Button size="sm" disabled={pending || dirty} onClick={() => go(() => startRun(props.run.id), "The run is out. Customers have been told it's on the way.")}>
                Send the run out
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Remove this run? Its orders go back to the unplanned list.")) go(() => deleteRun(props.run.id), "Run removed.", () => router.push("/delivery"));
                }}
              >
                Remove run
              </Button>
            </>
          )}
        </div>
        {planning && <p className="mt-2 text-[12px] text-carbon/55">Every stop must be packed before the run can go out. Use the arrows to set the order the rider follows.</p>}
      </Card>

      <ol className="space-y-2">
        {order.map((oid, i) => {
          const s = byId.get(oid)!;
          const settled = s.status === "DELIVERED" || s.status === "FAILED_DELIVERY";
          return (
            <li key={oid} className={cx("rounded-2xl bg-paper-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]", s.status === "DELIVERED" && "bg-mint-pop/15", s.status === "FAILED_DELIVERY" && "bg-ember/8")}>
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-carbon text-[13px] font-bold text-paper-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {s.customer} <span className="font-mono text-[12px] font-normal text-carbon/50">{s.ref}</span>
                  </p>
                  <p className="text-[13px] text-carbon/70">{s.address}</p>
                  <p className="text-[12px] text-carbon/50">{s.zone}</p>
                </div>
                <Badge tone={s.status === "DELIVERED" ? "good" : s.status === "FAILED_DELIVERY" ? "bad" : s.status === "PACKED" || s.status === "OUT_FOR_DELIVERY" ? "neutral" : "warn"}>{s.statusLabel}</Badge>
              </div>
              {planning && props.canPlan && (
                <div className="mt-3 flex gap-1.5 pl-11">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOrder((o) => o.filter((x) => x !== oid))}>
                    Take off run
                  </Button>
                </div>
              )}
              {props.run.status === "OUT" && props.canSettle && s.status === "OUT_FOR_DELIVERY" && !settled && (
                <div className="mt-3 grid grid-cols-2 gap-2 pl-11">
                  <Button disabled={pending} onClick={() => go(() => settleStop({ runId: props.run.id, orderId: s.id, version: s.version, delivered: true }), `${s.ref} delivered.`)}>
                    Delivered
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      const note = window.prompt("What happened? e.g. No one home, wrong address") ?? "";
                      if (note.trim()) go(() => settleStop({ runId: props.run.id, orderId: s.id, version: s.version, delivered: false, note }), `${s.ref} marked missed.`);
                    }}
                  >
                    Missed
                  </Button>
                </div>
              )}
            </li>
          );
        })}
        {order.length === 0 && <li className="rounded-2xl bg-paper-white p-6 text-center text-[13px] text-carbon/50">No stops on this run.</li>}
      </ol>
    </div>
  );
}
