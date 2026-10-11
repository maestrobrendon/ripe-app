"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card, Field, Input } from "../../_ui/kit";
import { createRun } from "./actions";

type LooseOrder = { id: string; ref: string; customer: string; zone: string; status: string; packed: boolean };
const selectClass = "h-11 w-full rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

/** Orders not on a run yet, by area, with a form to make a run from the ticked ones. */
export function RunPlanner({ day, canPlan, riders, orders, defaultName }: { day: string; canPlan: boolean; riders: { id: string; name: string }[]; orders: LooseOrder[]; defaultName: string }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(defaultName);
  const [riderId, setRiderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const zones = [...new Set(orders.map((o) => o.zone))];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Card title={`Not on a run (${orders.length})`}>
      {orders.length === 0 ? (
        <p className="text-[13px] text-carbon/50">Every order for this day is on a run.</p>
      ) : (
        <div className="space-y-4">
          {zones.map((z) => {
            const zo = orders.filter((o) => o.zone === z);
            const all = zo.every((o) => picked.includes(o.id));
            return (
              <div key={z}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{z}</p>
                  {canPlan && (
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-carbon/60 underline"
                      onClick={() => setPicked((p) => (all ? p.filter((x) => !zo.some((o) => o.id === x)) : [...new Set([...p, ...zo.map((o) => o.id)])]))}
                    >
                      {all ? "Untick area" : "Tick area"}
                    </button>
                  )}
                </div>
                <ul className="space-y-1">
                  {zo.map((o) => (
                    <li key={o.id}>
                      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-soft-mist/50">
                        {canPlan && <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />}
                        <span className="font-mono font-semibold">{o.ref}</span>
                        <span className="flex-1 truncate text-carbon/70">{o.customer}</span>
                        <span className={`text-[12px] ${o.packed ? "text-[#0b5a35]" : "text-carbon/50"}`}>{o.status}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {canPlan && (
            <form
              className="space-y-3 border-t border-black/6 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  setError(null);
                  const r = await run(() => createRun({ day, name, riderId: riderId || null, orderIds: picked }));
                  if (r.ok) router.push(`/delivery/runs/${r.data.id}`);
                  else if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Run name" htmlFor="run-name">
                  <Input id="run-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Rider" htmlFor="run-rider">
                  <select id="run-rider" className={selectClass} value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                    <option value="">Choose later</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button disabled={pending || picked.length === 0} className="w-full">
                Make a run with {picked.length} stop{picked.length === 1 ? "" : "s"}
              </Button>
              {riders.length === 0 && <p className="text-[12px] text-carbon/55">No riders yet. Add them under Riders.</p>}
              {error && <Alert tone="error">{error}</Alert>}
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
