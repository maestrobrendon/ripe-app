"use client";

import { useState, useTransition } from "react";
import { useAdminAction } from "../../step-up";
import { Button, cx } from "../../../_ui/kit";
import { naira } from "../../../_ui/format";
import { saveFleet } from "../actions";

type Rider = { id: string; name: string; phone: string; active: boolean; vehicle: string; capacity: number; costPerKm: number; partner: string | null; runs: number };
const box = "h-9 rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] disabled:bg-transparent disabled:shadow-none";

export function FleetRow({ rider, canEdit }: { rider: Rider; canEdit: boolean }) {
  const run = useAdminAction();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ vehicle: rider.vehicle, capacity: rider.capacity, costPerKm: rider.costPerKm, partner: rider.partner ?? "" });
  const [saved, setSaved] = useState(v);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  return (
    <tr className={cx("border-t border-black/5 align-middle", !rider.active && "opacity-50")}>
      <td className="py-2.5 pr-3">
        <p className="font-semibold">{rider.name}</p>
        <p className="text-[12px] text-carbon/55">
          {rider.active ? `${rider.runs} run${rider.runs === 1 ? "" : "s"}` : "Inactive"} · {rider.phone}
        </p>
      </td>
      <td className="py-2.5 pr-3">
        <select disabled={!canEdit} value={v.vehicle} onChange={(e) => setV({ ...v, vehicle: e.target.value })} className={box} aria-label={`${rider.name}'s vehicle`}>
          <option value="BIKE">Bike</option>
          <option value="CAR">Car</option>
          <option value="VAN">Van</option>
        </select>
      </td>
      <td className="py-2.5 pr-3">
        <input disabled={!canEdit} type="number" min={1} max={200} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={cx(box, "w-20 text-right tabular-nums")} aria-label={`${rider.name}'s stops per run`} />
      </td>
      <td className="py-2.5 pr-3">
        <span className="relative inline-block">
          <span className="pointer-events-none absolute inset-y-0 left-2 grid place-items-center text-carbon/45">₦</span>
          <input disabled={!canEdit} type="number" min={0} max={10000} step={10} value={v.costPerKm} onChange={(e) => setV({ ...v, costPerKm: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={cx(box, "w-24 pl-6 text-right tabular-nums")} aria-label={`${rider.name}'s rate per km`} />
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <input disabled={!canEdit} maxLength={60} value={v.partner} placeholder="Own rider" onChange={(e) => setV({ ...v, partner: e.target.value })} className={cx(box, "w-36")} aria-label={`${rider.name}'s partner company`} />
      </td>
      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{v.costPerKm ? naira(v.costPerKm * 10) : "-"}</td>
      <td className="py-2.5 text-right">
        {canEdit && (
          <Button
            size="sm"
            variant={dirty ? "primary" : "ghost"}
            disabled={pending || !dirty}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await run(() => saveFleet({ riderId: rider.id, ...v }));
                if (r.ok) setSaved(v);
                else if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
              })
            }
          >
            {pending ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        )}
        {error && <p className="mt-1 text-[11px] text-[#9a2c00]">{error}</p>}
      </td>
    </tr>
  );
}
