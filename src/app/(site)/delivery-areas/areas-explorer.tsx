"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { AreaCheck } from "@/components/areas/area-check";
import type { MapCircle, MapPin } from "@/components/maps/leaflet-map";
import { dayShort, inWeekOrder } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";
import type { AreaResult } from "@/lib/locate";
import { haptic } from "@/lib/haptics";

// Leaflet touches `window`, and the page reads fine before the map arrives.
const LeafletMap = dynamic(() => import("@/components/maps/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-[28px] bg-[#eef1ea]" />,
});

export type ExplorerZone = {
  slug: string;
  name: string;
  neighbourhoods: string[];
  days: DeliveryDay[];
  /** "6pm": orders close at this time the day before. */
  cutoff: string;
  at: { lat: number; lng: number; radiusKm: number } | null;
};

const LAGOS = { lat: 6.5, lng: 3.42 };
const GREEN = "#0f7a48";

/**
 * The check, the map and the list, which point at each other: finding
 * yourself, or tapping an area, marks it on the map and in the list.
 * Phones: check, map, list, top to bottom. Laptops: the list beside a map
 * that stays in view.
 */
export function AreasExplorer({ served, soon }: { served: ExplorerZone[]; soon: ExplorerZone[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | undefined>();
  const mapBox = useRef<HTMLDivElement>(null);
  // One map, in the spot that suits the screen (null until we know which).
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const show = (z: ExplorerZone, scroll: boolean) => {
    setActive(z.slug);
    haptic("selection");
    if (z.at) setFocus({ lat: z.at.lat, lng: z.at.lng, zoom: 13 });
    // On a phone the map is above the list: bring it back into view.
    if (scroll && !wide) mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onResult = (r: AreaResult) => {
    if (r.kind === "failed") return;
    setMe({ lat: r.at.lat, lng: r.at.lng });
    setActive(r.kind === "zone" ? r.zone.slug : null);
    setFocus({ lat: r.at.lat, lng: r.at.lng, zoom: 13 });
  };

  const circles: MapCircle[] = [
    ...served.filter((z) => z.at).map((z) => ({ id: z.slug, ...z.at!, color: GREEN, label: z.name, active: z.slug === active })),
    ...soon.filter((z) => z.at).map((z) => ({ id: z.slug, ...z.at!, color: "#6b7280", label: `${z.name} · soon`, dashed: true })),
  ];
  const pins: MapPin[] = me ? [{ id: "me", ...me, kind: "pick", color: "#2563eb", label: "You" }] : [];

  return (
    <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
      <div className="min-w-0">
        <section aria-labelledby="check-title" className="rounded-[28px] bg-[#f3f5f0] p-5 sm:p-6">
          <h2 id="check-title" className="text-[20px] leading-tight font-semibold tracking-[-0.025em]">
            Do we come to you?
          </h2>
          <p className="mt-1.5 mb-4 text-[15px] text-carbon/65">One tap, and we&apos;ll check where you are.</p>
          <AreaCheck onResult={onResult} instead="Find your area in the list below." />
        </section>

        {/* Phones: the map comes straight after the check. */}
        <div ref={mapBox} className="mt-8 h-[360px] lg:hidden">
          {wide === false && <AreaMap circles={circles} pins={pins} focus={focus} />}
        </div>

        <h2 className="mt-10 text-[13px] font-semibold tracking-[0.06em] text-carbon/50 uppercase">Areas we deliver to</h2>
        <ul className="mt-3 grid gap-2.5">
          {served.map((z) => {
            const on = z.slug === active;
            return (
              <li key={z.slug}>
                <button
                  type="button"
                  onClick={() => show(z, true)}
                  aria-pressed={on}
                  className={`w-full rounded-[22px] p-4 text-left transition-[background-color,box-shadow] sm:p-5 ${on ? "bg-paper-white shadow-[0_0_0_2px_var(--carbon)]" : "bg-[#f3f5f0] hover:bg-[#e8ede3]"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <i className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#0f7a48]" aria-hidden />
                      <b className="text-[18px] leading-tight font-semibold tracking-[-0.02em]">{z.name}</b>
                    </span>
                    <span className="flex shrink-0 gap-1" aria-label={`Delivers ${inWeekOrder(z.days).map(dayShort).join(", ")}`}>
                      {inWeekOrder(z.days).map((d) => (
                        <span key={d} className="rounded-full bg-paper-white px-2 py-0.5 text-[12px] font-semibold" aria-hidden>
                          {dayShort(d)}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {z.neighbourhoods.map((n) => (
                      <span key={n} className={`rounded-full px-2.5 py-1 text-[13px] ${on ? "bg-[#f3f5f0]" : "bg-paper-white"}`}>
                        {n}
                      </span>
                    ))}
                  </span>
                  <span className="mt-3 block text-[13px] text-carbon/55">Order by {z.cutoff} the day before</span>
                </button>
              </li>
            );
          })}
        </ul>

        {soon.length > 0 && <ComingSoon soon={soon} />}
      </div>

      {/* Laptops: the map stays in view beside the list. */}
      <div className="hidden lg:block">
        <div className="sticky top-24 h-[min(640px,calc(100svh-8rem))]">
          {wide && <AreaMap circles={circles} pins={pins} focus={focus} />}
        </div>
      </div>
    </div>
  );
}

function AreaMap({ circles, pins, focus }: { circles: MapCircle[]; pins: MapPin[]; focus?: { lat: number; lng: number; zoom: number } }) {
  return <LeafletMap center={LAGOS} zoom={11} circles={circles} pins={pins} focus={focus} fit={!focus} className="map-soft h-full rounded-[28px]!" />;
}

function ComingSoon({ soon }: { soon: ExplorerZone[] }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const names = soon.map((z) => z.name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, zoneRequested: names.join(", ") }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  };

  return (
    <section aria-labelledby="soon-title" className="mt-10 rounded-[28px] border-2 border-dashed border-carbon/12 p-5 sm:p-6">
      <h2 id="soon-title" className="text-[13px] font-semibold tracking-[0.06em] text-carbon/50 uppercase">
        Coming next
      </h2>
      <p className="mt-2 text-[20px] leading-tight font-semibold tracking-[-0.025em]">{names.join(", ")}</p>
      {state === "done" ? (
        <p className="mt-3 text-[15px] text-carbon/65">Thanks. We&apos;ll email you the week we start.</p>
      ) : (
        <>
          <p className="mt-1.5 text-[15px] text-carbon/65">Leave your email and we&apos;ll tell you the week we start.</p>
          <form onSubmit={submit} className="mt-4 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Your email"
              className="h-12 min-w-0 flex-1 rounded-full bg-[#f3f5f0] px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-carbon"
            />
            <button type="submit" disabled={state === "saving"} className="h-12 shrink-0 rounded-full bg-carbon px-5 text-[15px] font-semibold text-paper-white disabled:opacity-60">
              Notify me
            </button>
          </form>
          {state === "error" && <p className="mt-2 text-[13px] text-ember">That didn&apos;t go through. Check the email and try again.</p>}
        </>
      )}
    </section>
  );
}
