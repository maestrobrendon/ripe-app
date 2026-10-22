"use client";

import { useState, useTransition } from "react";
import { LeafletMap, type MapPin } from "@/components/maps/leaflet-map";
import { useAdminAction } from "../../step-up";
import { Alert, Card } from "../../../_ui/kit";
import { naira } from "../../../_ui/format";
import { quotePoint, type Quote } from "../actions";
import { PlaceSearch } from "../place-search";

export function Calculator({ depot, enabled }: { depot: { lat: number; lng: number; label: string }; enabled: boolean }) {
  const run = useAdminAction();
  const [pending, start] = useTransition();
  const [to, setTo] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = (p: { lat: number; lng: number; label?: string }) => {
    setTo(p);
    start(async () => {
      setError(null);
      const r = await run(() => quotePoint({ lat: p.lat, lng: p.lng }));
      if (r.ok) setQuote(r.data);
      else if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
    });
  };

  const pins: MapPin[] = [{ id: "depot", lat: depot.lat, lng: depot.lng, kind: "depot", text: "H", label: depot.label || "Depot" }];
  if (to) pins.push({ id: "to", lat: to.lat, lng: to.lng, kind: "pick", label: to.label ?? "Here", color: "#1f6fd1", draggable: true });

  const b = quote?.breakdown;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <PlaceSearch onPick={ask} placeholder="Search an address, estate or landmark in Lagos" />
        <LeafletMap center={depot} pins={pins} lines={quote ? [{ id: "road", points: quote.line, color: "#1f6fd1" }] : []} onPick={ask} onDrag={(_, p) => ask(p)} className="h-[560px]" />
      </div>

      <div className="space-y-4">
        {!to && <Alert>Pick a point to see the fee. Drag the blue pin to fine-tune it.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {to && (
          <Card className={pending ? "opacity-60" : undefined}>
            <p className="text-[12px] text-carbon/55">{to.label ? to.label.split(",").slice(0, 3).join(",") : `${to.lat.toFixed(5)}, ${to.lng.toFixed(5)}`}</p>
            {pending && !quote ? (
              <p className="mt-4 text-[14px] text-carbon/60">Measuring the road…</p>
            ) : (
              quote &&
              b && (
                <>
                  <p className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{naira(b.fee)}</p>
                  <p className="mt-2 text-[13px] text-carbon/65">
                    {quote.km.toFixed(1)} km by road · about {Math.round(quote.min)} min in traffic
                  </p>
                  <dl className="mt-5 space-y-1.5 border-t border-black/6 pt-4 text-[13px]">
                    <Row label="Base fee" value={naira(b.base)} />
                    <Row label={`${b.chargedKm.toFixed(1)} km × rate`} value={naira(b.distanceCharge)} />
                    <Row label="Before rounding" value={naira(b.raw)} muted />
                    {b.notes.map((n) => (
                      <p key={n} className="text-[12px] text-carbon/55">
                        {n}
                      </p>
                    ))}
                    <Row label="Customer pays" value={naira(b.fee)} strong />
                  </dl>
                  {quote.approximate && <p className="mt-3 text-[12px] text-[#6b5000]">The road server didn&apos;t answer; this is a straight-line estimate.</p>}
                  {!enabled && <p className="mt-3 text-[12px] text-carbon/55">Distance pricing is off, so the site still charges each area&apos;s flat fee.</p>}
                </>
              )
            )}
          </Card>
        )}
        {quote && (
          <Card title="For comparison">
            <ul className="grid grid-cols-3 gap-2">
              {quote.scale.map((x) => (
                <li key={x.km} className="rounded-xl bg-soft-mist/50 px-3 py-2 text-center">
                  <p className="text-[11px] text-carbon/55">{x.km} km</p>
                  <p className="text-[14px] font-semibold tabular-nums">{naira(x.fee)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-carbon/50" : ""} ${strong ? "border-t border-black/6 pt-2 text-[14px] font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
