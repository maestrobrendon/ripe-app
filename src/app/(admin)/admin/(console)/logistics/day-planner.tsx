"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeafletMap, type MapLine, type MapPin } from "@/components/maps/leaflet-map";
import { useAdminAction } from "../step-up";
import { Alert, Badge, Button, Card, cx } from "../../_ui/kit";
import { naira } from "../../_ui/format";
import { locateOrders, moveStop, nameSpot, planDay, saveDepot, savePlan, type DayPlan } from "./actions";
import { PlaceSearch } from "./place-search";
import { ROUTE_COLORS } from "./colors";

type Stop = { id: string; name: string; address: string; zone: string; fee: number; lat: number | null; lng: number | null; precision: "exact" | "found" | "area" | "none" };
type Rider = { id: string; name: string; vehicle: string; capacity: number; costPerKm: number; partner: string | null };
type Vehicle = { key: string; riderId: string | null; capacity: number; on: boolean };

const PRECISION = { exact: "Exact", found: "Found from address", area: "Area only", none: "Not on the map" } as const;
const VEHICLE = { BIKE: "Bike", CAR: "Car", VAN: "Van" } as Record<string, string>;
const hm = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`);

export function DayPlanner({
  day,
  depot,
  startTime,
  trafficFactor,
  returnToDepot: defaultReturn,
  canPlan,
  canMoveDepot,
  stops: initialStops,
  riders,
}: {
  day: string;
  depot: { lat: number; lng: number; label: string };
  startTime: string;
  trafficFactor: number;
  returnToDepot: boolean;
  canPlan: boolean;
  canMoveDepot: boolean;
  stops: Stop[];
  riders: Rider[];
}) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stops, setStops] = useState(initialStops);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() =>
    riders.length ? riders.map((r) => ({ key: r.id, riderId: r.id, capacity: r.capacity, on: true })) : [{ key: "v1", riderId: null, capacity: 20, on: true }],
  );
  const [back, setBack] = useState(defaultReturn);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [stale, setStale] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [note, setNote] = useState<{ tone: "error" | "success" | "warn"; text: string } | null>(null);
  // Where today's runs leave from: the usual dispatch point unless moved for this plan.
  const [from, setFrom] = useState(depot);
  const [choosing, setChoosing] = useState(false);
  const moved = from.lat !== depot.lat || from.lng !== depot.lng;

  const onMap = stops.filter((s) => s.lat != null && s.lng != null);
  const missing = stops.filter((s) => s.lat == null);
  const rough = stops.filter((s) => s.precision === "area" || s.precision === "found").length;
  const active = vehicles.filter((v) => v.on);
  const riderOf = (id: string | null) => riders.find((r) => r.id === id);
  const changed = () => plan && setStale(true);

  // Before planning: every stop, faded when approximate. After: numbered and coloured by route.
  const { pins, lines } = useMemo(() => {
    const depotPin: MapPin = { id: "depot", lat: from.lat, lng: from.lng, kind: "depot", text: "H", label: `Dispatch: ${from.label || "Depot"}${canPlan ? " (drag to move)" : ""}`, color: moved ? "#1f6fd1" : undefined, draggable: canPlan };
    if (!plan) {
      return {
        pins: [depotPin, ...onMap.map((s): MapPin => ({ id: s.id, lat: s.lat!, lng: s.lng!, label: `${s.name} · ${s.zone}`, color: "#495057", faint: s.precision === "area", draggable: canPlan }))],
        lines: [] as MapLine[],
      };
    }
    const routePins = plan.routes.flatMap((r, ri) =>
      r.stops.map((s, i): MapPin => {
        const now = stops.find((x) => x.id === s.id);
        return {
          id: s.id,
          lat: now?.lat ?? s.lat,
          lng: now?.lng ?? s.lng,
          text: String(i + 1),
          label: `${i + 1}. ${s.name} · ${r.etas[i] ?? ""}`,
          color: ROUTE_COLORS[ri % ROUTE_COLORS.length],
          faint: (focus != null && focus !== ri) || s.approximate,
          draggable: canPlan,
        };
      }),
    );
    const left = plan.unassigned.map((s): MapPin => ({ id: s.id, lat: s.lat, lng: s.lng, text: "!", label: `${s.name}: no room on any vehicle`, color: "#e03131" }));
    return {
      pins: [depotPin, ...routePins, ...left],
      lines: plan.routes
        .map((r, ri): MapLine => ({ id: `r${ri}`, points: r.line, color: ROUTE_COLORS[ri % ROUTE_COLORS.length], dashed: stale || (focus != null && focus !== ri) }))
        .filter((l) => l.points.length > 1),
    };
  }, [plan, onMap, stops, from, moved, focus, stale, canPlan]);

  const moveDispatch = (p: { lat: number; lng: number }, label?: string) => {
    setFrom({ lat: p.lat, lng: p.lng, label: label ?? "Dropped pin" });
    setChoosing(false);
    changed();
    if (label) return;
    void run(() => nameSpot(p)).then((r) => {
      if (r.ok && r.data) setFrom((f) => (f.lat === p.lat && f.lng === p.lng ? { ...f, label: r.data! } : f));
    });
  };

  const makeDefault = () =>
    start(async () => {
      const r = await run(() => saveDepot(from));
      if (!r.ok) {
        if (r.code !== "AUTH" && r.code !== "STEP_UP") setNote({ tone: "error", text: r.error });
        return;
      }
      setNote({ tone: "success", text: `Runs now leave from ${from.label} by default. Area distances were measured again from there.` });
      router.refresh();
    });

  const doPlan = () =>
    start(async () => {
      setNote(null);
      setFocus(null);
      const r = await run(() => planDay({ day, vehicles: active.map((v) => ({ riderId: v.riderId, capacity: v.capacity })), returnToDepot: back, from: { lat: from.lat, lng: from.lng } }));
      if (!r.ok) {
        if (r.code !== "AUTH" && r.code !== "STEP_UP") setNote({ tone: "error", text: r.error });
        return;
      }
      setPlan(r.data);
      setStale(false);
      setNames(r.data.routes.map((rt, i) => `${riderOf(rt.riderId)?.name ?? `Vehicle ${i + 1}`} · ${dayName(day)}`));
      if (r.data.unassigned.length) setNote({ tone: "warn", text: `${r.data.unassigned.length} stop${r.data.unassigned.length === 1 ? "" : "s"} didn't fit. Add a vehicle or raise a capacity, then plan again.` });
    });

  const doSave = () =>
    start(async () => {
      if (!plan) return;
      const routes = plan.routes
        .map((r, i) => ({ riderId: r.riderId, name: names[i]?.trim() || `Vehicle ${i + 1}`, orderIds: r.stops.map((s) => s.id), km: r.km, min: r.min, line: r.line }))
        .filter((r) => r.orderIds.length);
      const res = await run(() => savePlan({ day, routes }));
      if (!res.ok) {
        if (res.code !== "AUTH" && res.code !== "STEP_UP") setNote({ tone: "error", text: res.error });
        return;
      }
      setPlan(null);
      setNote({ tone: "success", text: `Saved as ${res.data.runs} run${res.data.runs === 1 ? "" : "s"}. Riders can see their stops in order under Delivery.` });
      router.refresh();
    });

  const doLocate = () =>
    start(async () => {
      setNote(null);
      const r = await run(() => locateOrders(day));
      if (!r.ok) {
        if (r.code !== "AUTH" && r.code !== "STEP_UP") setNote({ tone: "error", text: r.error });
        return;
      }
      setNote({ tone: r.data.left ? "warn" : "success", text: r.data.found ? `Found ${r.data.found} on the map${r.data.left ? `; ${r.data.left} still to place. Drag them right or try again.` : ". Check the faded pins and drag any that are off."}` : "Couldn't find those from their address. Drop them by hand: set the area's middle in Delivery areas, or drag a pin." });
      router.refresh();
    });

  const onDrag = (id: string, p: { lat: number; lng: number }) => {
    if (id === "depot") return moveDispatch(p);
    setStops((all) => all.map((s) => (s.id === id ? { ...s, ...p, precision: "exact" } : s)));
    changed();
    void run(() => moveStop({ orderId: id, ...p })).then((r) => {
      if (!r.ok && r.code !== "AUTH" && r.code !== "STEP_UP") setNote({ tone: "error", text: r.error });
    });
  };

  const totals = plan && {
    km: plan.routes.reduce((t, r) => t + r.km, 0),
    longest: Math.max(0, ...plan.routes.map((r) => r.min)),
    cost: plan.routes.reduce((t, r) => t + r.cost, 0),
    charged: plan.routes.reduce((t, r) => t + r.charged, 0),
    finish: plan.routes.reduce((t, r) => (r.stops.length && r.finish > t ? r.finish : t), ""),
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <div className="relative">
          <LeafletMap center={from} pins={pins} lines={lines} onDrag={canPlan ? onDrag : undefined} onPick={choosing ? (p) => moveDispatch(p) : undefined} className={cx("h-[560px]", choosing && "cursor-crosshair!")} />
          {choosing && <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full bg-carbon px-4 py-2 text-[13px] font-semibold text-paper-white shadow-lg">Click the map where runs leave from</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-carbon/60">
          <span>
            <b className="text-carbon">{stops.length}</b> order{stops.length === 1 ? "" : "s"} to plan
          </span>
          {rough > 0 && <span>{rough} placed roughly (faded): drag a pin to where the house really is</span>}
          {missing.length > 0 && <span className="text-[#9a2c00]">{missing.length} not on the map</span>}
          <span className="ml-auto">Times include Lagos traffic ×{trafficFactor} from {startTime}</span>
        </div>

        {totals && (
          <div className={cx("grid grid-cols-2 gap-3 sm:grid-cols-5", stale && "opacity-50")}>
            <Figure label="Distance" value={`${totals.km.toFixed(1)} km`} />
            <Figure label="Longest route" value={hm(totals.longest)} />
            <Figure label="All back by" value={totals.finish || "-"} />
            <Figure label="Cost to deliver" value={naira(totals.cost)} note={totals.cost ? undefined : "Set rates in Fleet"} />
            <Figure label="Margin" value={naira(totals.charged - totals.cost)} note={`${naira(totals.charged)} charged`} tone={totals.charged - totals.cost < 0 ? "bad" : "good"} />
          </div>
        )}

        {plan?.approximate && <Alert tone="warn">The road server didn&apos;t answer, so distances are straight-line estimates. Plan again in a minute for real roads.</Alert>}
      </div>

      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-carbon/55">Runs leave from</p>
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-[5px] text-[10px] font-bold text-white", moved ? "bg-[#1f6fd1]" : "bg-black")}>H</span>
                <span className="truncate">{from.label || "Dispatch point"}</span>
              </p>
            </div>
            {canPlan && (
              <button type="button" className="shrink-0 text-[13px] font-semibold text-carbon/60 hover:text-carbon" onClick={() => setChoosing(!choosing)} aria-expanded={choosing}>
                {choosing ? "Cancel" : "Change"}
              </button>
            )}
          </div>
          {choosing && (
            <div className="mt-3 space-y-2">
              <PlaceSearch onPick={(p) => moveDispatch(p, p.label.split(",").slice(0, 2).join(","))} placeholder="Search a market, hub or address" />
              <p className="text-[12px] text-carbon/55">Or click the map, or drag the H.</p>
            </div>
          )}
          {moved && (
            <div className="mt-3 border-t border-black/6 pt-3">
              <p className="text-[12px] text-carbon/60">Moved for this plan only. Usual: {depot.label || "the depot"}.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {canMoveDepot && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={makeDefault}>
                    Make it the usual
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setFrom(depot);
                    changed();
                  }}
                >
                  Put it back
                </Button>
              </div>
              {canMoveDepot && <p className="mt-2 text-[11px] text-carbon/50">Making it the usual also re-measures each area, which changes area prices when distance pricing is on.</p>}
            </div>
          )}
        </Card>

        <Card title="Vehicles">
          <ul className="space-y-2">
            {vehicles.map((v, i) => {
              const r = riderOf(v.riderId);
              return (
                <li key={v.key} className="flex items-center gap-3 text-[13px]">
                  <input
                    type="checkbox"
                    checked={v.on}
                    aria-label={`Use ${r?.name ?? `vehicle ${i + 1}`}`}
                    onChange={() => {
                      setVehicles((all) => all.map((x) => (x.key === v.key ? { ...x, on: !x.on } : x)));
                      changed();
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{r?.name ?? `Vehicle ${i + 1}`}</span>
                    <span className="block truncate text-[12px] text-carbon/55">
                      {r ? `${VEHICLE[r.vehicle] ?? r.vehicle}${r.partner ? ` · ${r.partner}` : ""}${r.costPerKm ? ` · ${naira(r.costPerKm)}/km` : ""}` : "No rider yet"}
                    </span>
                  </span>
                  <label className="flex items-center gap-1.5 text-[12px] text-carbon/60">
                    Up to
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={v.capacity}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(200, Number(e.target.value) || 1));
                        setVehicles((all) => all.map((x) => (x.key === v.key ? { ...x, capacity: n } : x)));
                        changed();
                      }}
                      className="h-8 w-14 rounded-lg bg-paper-white px-2 text-right text-[13px] tabular-nums shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/6 pt-3">
            <button
              type="button"
              className="text-[12px] font-semibold text-carbon/60 hover:text-carbon"
              onClick={() => {
                setVehicles((all) => [...all, { key: `v${all.length + 1}-${Date.now()}`, riderId: null, capacity: 20, on: true }]);
                changed();
              }}
            >
              + Another vehicle
            </button>
            <label className="flex items-center gap-2 text-[12px] text-carbon/70">
              <input
                type="checkbox"
                checked={back}
                onChange={() => {
                  setBack(!back);
                  changed();
                }}
              />
              Come back to the depot
            </label>
          </div>
          <Button className="mt-4 w-full" disabled={pending || !active.length || !onMap.length} onClick={doPlan}>
            {pending ? "Working out the routes…" : plan ? (stale ? "Plan again with changes" : "Plan again") : `Plan ${onMap.length} stop${onMap.length === 1 ? "" : "s"} across ${active.length} vehicle${active.length === 1 ? "" : "s"}`}
          </Button>
          {!onMap.length && stops.length > 0 && <p className="mt-2 text-[12px] text-carbon/55">Put the orders on the map first (below).</p>}
          {!stops.length && <p className="mt-2 text-[12px] text-carbon/55">Nothing to plan for this day: every order is on a run, or there are none.</p>}
        </Card>

        {note && <Alert tone={note.tone}>{note.text}</Alert>}

        {plan && (
          <div className="space-y-3">
            {plan.routes.map((r, ri) =>
              r.stops.length ? (
                <RouteCard
                  key={ri}
                  index={ri}
                  route={r}
                  rider={riderOf(r.riderId)}
                  name={names[ri] ?? ""}
                  onName={(n) => setNames((all) => all.map((x, i) => (i === ri ? n : x)))}
                  focused={focus === ri}
                  onFocus={() => setFocus(focus === ri ? null : ri)}
                  stale={stale}
                />
              ) : (
                <p key={ri} className="rounded-xl bg-soft-mist/50 px-4 py-3 text-[13px] text-carbon/55">
                  {riderOf(r.riderId)?.name ?? `Vehicle ${ri + 1}`} isn&apos;t needed for this day.
                </p>
              ),
            )}
            {canPlan && (
              <Button className="w-full" disabled={pending || stale || !plan.routes.some((r) => r.stops.length)} onClick={doSave}>
                {stale ? "Plan again before saving" : `Save as ${plan.routes.filter((r) => r.stops.length).length} run${plan.routes.filter((r) => r.stops.length).length === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        )}

        {missing.length > 0 && (
          <Card title={`Not on the map (${missing.length})`}>
            <p className="mb-3 text-[12px] text-carbon/60">These addresses have no pin and their area has no middle set. Find them from the address, then check the pins.</p>
            <ul className="mb-3 space-y-1.5">
              {missing.slice(0, 8).map((s) => (
                <li key={s.id} className="text-[13px]">
                  <span className="font-semibold">{s.name}</span> <span className="text-carbon/60">{s.address}</span>
                </li>
              ))}
              {missing.length > 8 && <li className="text-[12px] text-carbon/50">and {missing.length - 8} more</li>}
            </ul>
            {canPlan && (
              <Button variant="secondary" size="sm" disabled={pending} onClick={doLocate}>
                {pending ? "Looking them up (one a second)…" : "Find them from the address"}
              </Button>
            )}
          </Card>
        )}

        {!plan && onMap.length > 0 && (
          <Card title="Stops">
            <ul className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {onMap.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{s.name}</span> <span className="text-carbon/55">{s.zone}</span>
                  </span>
                  <Badge tone={s.precision === "exact" ? "good" : s.precision === "area" ? "warn" : "neutral"}>{PRECISION[s.precision]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function RouteCard({
  index,
  route,
  rider,
  name,
  onName,
  focused,
  onFocus,
  stale,
}: {
  index: number;
  route: DayPlan["routes"][number];
  rider?: Rider;
  name: string;
  onName: (n: string) => void;
  focused: boolean;
  onFocus: () => void;
  stale: boolean;
}) {
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
  const margin = route.charged - route.cost;
  return (
    <section className={cx("rounded-2xl bg-paper-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]", focused && "shadow-[0_0_0_2px_var(--color-carbon)]", stale && "opacity-60")}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onFocus} aria-pressed={focused} aria-label="Show only this route on the map" className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white ring-offset-1" style={{ background: color, boxShadow: `0 0 0 1px ${color}` }} />
        <input value={name} onChange={(e) => onName(e.target.value)} maxLength={60} aria-label="Run name" className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none focus:underline" />
        <button type="button" onClick={onFocus} className="text-[12px] font-semibold text-carbon/55 hover:text-carbon">
          {focused ? "Show all" : "Focus"}
        </button>
      </div>
      <p className="mt-1 text-[12px] text-carbon/60">
        {route.stops.length} stop{route.stops.length === 1 ? "" : "s"} · {route.km.toFixed(1)} km · {hm(route.min)} · back by {route.finish}
        {rider?.costPerKm ? ` · costs ${naira(route.cost)}` : ""}
        {rider?.costPerKm ? <span className={margin < 0 ? "text-[#9a2c00]" : "text-[#0b5a35]"}> ({margin < 0 ? "−" : "+"}{naira(Math.abs(margin))})</span> : null}
      </p>
      <ol className="mt-3 space-y-1.5">
        {route.stops.map((s, i) => (
          <li key={s.id} className="flex items-start gap-2.5 text-[13px]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{s.name}</span>
              {s.approximate && <span className="text-[11px] text-[#6b5000]"> · area only</span>}
              <span className="block truncate text-[12px] text-carbon/55">{s.address}</span>
            </span>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-carbon/70">{route.etas[i]}</span>
          </li>
        ))}
      </ol>
      {route.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-black/6 pt-3">
          {route.links.map((href, i) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg bg-soft-mist/70 px-3 text-[12px] font-semibold hover:bg-soft-mist">
              Open in Google Maps{route.links.length > 1 ? ` (part ${i + 1})` : ""} ↗
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl bg-paper-white px-4 py-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <p className="text-[12px] text-carbon/55">{label}</p>
      <p className={cx("text-[18px] font-semibold tabular-nums tracking-[-0.01em]", tone === "bad" && "text-[#9a2c00]", tone === "good" && "text-[#0b5a35]")}>{value}</p>
      {note && <p className="text-[11px] text-carbon/50">{note}</p>}
    </div>
  );
}

const dayName = (ymd: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
