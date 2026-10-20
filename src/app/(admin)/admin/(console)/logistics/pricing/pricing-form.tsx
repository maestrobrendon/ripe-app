"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { priceDelivery } from "@/lib/logistics/pricing";
import type { LogisticsSettings } from "@/lib/delivery-logistics";
import { useAdminAction } from "../../step-up";
import { Alert, Button, Card, Field, Input, cx } from "../../../_ui/kit";
import { naira } from "../../../_ui/format";
import { saveLogisticsSettings } from "../actions";
import { PlaceSearch } from "../place-search";

type Zone = { id: string; name: string; flat: number; located: boolean; km: number | null };
type Rules = LogisticsSettings["rules"];

const SAMPLE_KM = [1, 3, 5, 8, 10, 15, 20, 25, 30];

export function PricingForm({ initial, canEdit, zones }: { initial: LogisticsSettings; canEdit: boolean; zones: Zone[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(initial);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const rules = (patch: Partial<Rules>) => setS((x) => ({ ...x, rules: { ...x.rules, ...patch } }));
  const fee = (km: number) => priceDelivery(km, s.rules).fee;
  const depotMoved = s.depot.lat !== initial.depot.lat || s.depot.lng !== initial.depot.lng;

  const save = () =>
    start(async () => {
      setNote(null);
      const r = await run(() => saveLogisticsSettings(s));
      if (!r.ok) {
        if (r.code !== "AUTH" && r.code !== "STEP_UP") setNote({ tone: "error", text: r.error });
        return;
      }
      setNote({ tone: "success", text: `Saved. ${s.enabled ? `Fees now follow distance; ${r.data.zones} area${r.data.zones === 1 ? "" : "s"} measured from the depot.` : "Every area keeps its flat fee until distance pricing is on."}` });
      router.refresh();
    });

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Card>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={s.enabled} disabled={!canEdit} onChange={() => setS({ ...s, enabled: !s.enabled })} />
            <span>
              <span className="block text-[15px] font-semibold">Price deliveries by distance</span>
              <span className="block text-[13px] text-carbon/60">
                Off: each area charges its flat fee from Delivery areas. On: the fee is worked out from road kilometres, from the customer&apos;s pin when they drop one, else from the middle of their area.
              </span>
            </span>
          </label>
        </Card>

        <Card title="The rule">
          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-3">
            <Field label="Base fee" htmlFor="base" hint="On every delivery">
              <Money id="base" value={s.rules.baseFee} onChange={(v) => rules({ baseFee: v })} />
            </Field>
            <Field label="Per kilometre" htmlFor="perkm" hint={`After the first ${s.rules.includedKm} km`}>
              <Money id="perkm" value={s.rules.perKm} onChange={(v) => rules({ perKm: v })} />
            </Field>
            <Field label="Kilometres in the base" htmlFor="incl" hint="Covered by the base fee">
              <Input id="incl" type="number" min={0} max={100} step={0.5} value={s.rules.includedKm} onChange={(e) => rules({ includedKm: num(e.target.value) })} />
            </Field>
            <Field label="Minimum fee" htmlFor="min">
              <Money id="min" value={s.rules.minFee} onChange={(v) => rules({ minFee: v })} />
            </Field>
            <Field label="Maximum fee" htmlFor="max" hint="0 for no cap">
              <Money id="max" value={s.rules.maxFee} onChange={(v) => rules({ maxFee: v })} />
            </Field>
            <Field label="Round up to" htmlFor="round" hint="So fees look tidy">
              <select id="round" value={s.rules.roundTo} onChange={(e) => rules({ roundTo: Number(e.target.value) })} className="h-11 w-full rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]">
                {[1, 50, 100, 250, 500].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "No rounding" : `Nearest ${naira(n)}`}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>
          <p className="mt-4 rounded-xl bg-soft-mist/60 px-3.5 py-2.5 text-[13px] text-carbon/75">
            {naira(s.rules.baseFee)} + {naira(s.rules.perKm)} for each km past {s.rules.includedKm} km, rounded up to {s.rules.roundTo > 1 ? naira(s.rules.roundTo) : "the naira"}, never under {naira(s.rules.minFee)}
            {s.rules.maxFee > 0 ? ` or over ${naira(s.rules.maxFee)}` : ""}. A 10 km delivery costs <b>{naira(fee(10))}</b>.
          </p>
        </Card>

        <Card title="Where runs start">
          <p className="mb-3 text-[13px] text-carbon/60">Every distance is measured from here: your hub, market or kitchen. Search, or click the map.</p>
          {canEdit && <PlaceSearch onPick={(p) => setS({ ...s, depot: { lat: p.lat, lng: p.lng, label: p.label.split(",").slice(0, 2).join(",") } })} placeholder="Search for the depot's address" />}
          <LeafletMap
            center={s.depot}
            zoom={13}
            pins={[{ id: "depot", lat: s.depot.lat, lng: s.depot.lng, kind: "depot", text: "H", label: s.depot.label, draggable: canEdit }]}
            onPick={canEdit ? (p) => setS({ ...s, depot: { ...s.depot, ...p } }) : undefined}
            onDrag={canEdit ? (_, p) => setS({ ...s, depot: { ...s.depot, ...p } }) : undefined}
            fit={false}
            className="mt-3 h-[300px]"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Name" htmlFor="depot-label">
              <Input id="depot-label" maxLength={120} disabled={!canEdit} value={s.depot.label} onChange={(e) => setS({ ...s, depot: { ...s.depot, label: e.target.value } })} />
            </Field>
            <p className="self-end pb-3 font-mono text-[12px] text-carbon/50">
              {s.depot.lat.toFixed(5)}, {s.depot.lng.toFixed(5)}
            </p>
          </div>
          {depotMoved && <p className="mt-2 text-[12px] text-[#6b5000]">Moved. Area distances are measured again when you save.</p>}
        </Card>

        <Card title="Planning">
          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-3">
            <Field label="Lagos traffic" htmlFor="traffic" hint={`Road times ×${s.trafficFactor.toFixed(1)}`}>
              <input id="traffic" type="range" min={1} max={3} step={0.1} value={s.trafficFactor} onChange={(e) => setS({ ...s, trafficFactor: Number(e.target.value) })} className="h-11 w-full accent-carbon" />
            </Field>
            <Field label="Minutes at each stop" htmlFor="service" hint="Parking, handover, payment">
              <Input id="service" type="number" min={0} max={60} value={s.serviceMin} onChange={(e) => setS({ ...s, serviceMin: Math.round(num(e.target.value)) })} />
            </Field>
            <Field label="Runs leave at" htmlFor="startTime">
              <Input id="startTime" type="time" value={s.startTime} onChange={(e) => setS({ ...s, startTime: e.target.value || "09:00" })} />
            </Field>
          </fieldset>
          <label className="mt-4 flex items-center gap-2 text-[13px]">
            <input type="checkbox" disabled={!canEdit} checked={s.returnToDepot} onChange={() => setS({ ...s, returnToDepot: !s.returnToDepot })} />
            Riders come back to the depot at the end (counts the return trip in time and cost)
          </label>
        </Card>

        {canEdit && (
          <div className="flex items-center gap-3">
            <Button disabled={pending} onClick={save}>
              {pending ? "Saving and measuring areas…" : "Save pricing"}
            </Button>
            {note && <Alert tone={note.tone}>{note.text}</Alert>}
          </div>
        )}
        {!canEdit && <Alert>You can see pricing; changing it needs the Delivery areas permission.</Alert>}
      </div>

      <div className="space-y-5">
        <Card title="What customers pay">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-carbon/50">
                <th className="pb-2 font-medium">Distance</th>
                <th className="pb-2 text-right font-medium">Fee</th>
                <th className="w-1/2 pb-2" />
              </tr>
            </thead>
            <tbody>
              {SAMPLE_KM.map((km) => {
                const f = fee(km);
                const top = Math.max(...SAMPLE_KM.map(fee), 1);
                return (
                  <tr key={km} className="border-t border-black/5">
                    <td className="py-1.5 tabular-nums">{km} km</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{naira(f)}</td>
                    <td className="py-1.5 pl-3">
                      <span className="block h-1.5 rounded-full bg-mint-pop" style={{ width: `${(f / top) * 100}%` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="By area">
          {zones.length === 0 ? (
            <p className="text-[13px] text-carbon/55">No areas served yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-carbon/50">
                  <th className="pb-2 font-medium">Area</th>
                  <th className="pb-2 text-right font-medium">Road km</th>
                  <th className="pb-2 text-right font-medium">Flat</th>
                  <th className="pb-2 text-right font-medium">By distance</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => {
                  const d = z.km != null ? fee(z.km) : null;
                  return (
                    <tr key={z.id} className="border-t border-black/5">
                      <td className="py-1.5">{z.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-carbon/60">{z.km != null ? z.km.toFixed(1) : z.located ? "save to measure" : "-"}</td>
                      <td className={cx("py-1.5 text-right tabular-nums", s.enabled && d != null && "text-carbon/40 line-through")}>{naira(z.flat)}</td>
                      <td className={cx("py-1.5 text-right font-semibold tabular-nums", d != null && d > z.flat && "text-[#9a2c00]", d != null && d < z.flat && "text-[#0b5a35]")}>{d != null ? naira(d) : "flat"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[12px] text-carbon/55">
            An area with no middle on the map keeps its flat fee. Set the middle in Delivery areas. A customer who drops a pin on their address is priced from that pin instead.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Money({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-[15px] text-carbon/45">₦</span>
      <Input id={id} type="number" inputMode="numeric" min={0} step={50} value={value} onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))} className="pl-8 tabular-nums" />
    </div>
  );
}
