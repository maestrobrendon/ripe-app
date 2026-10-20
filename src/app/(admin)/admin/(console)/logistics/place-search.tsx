"use client";

import { useState, useTransition } from "react";
import { useAdminAction } from "../step-up";
import { Button, Input } from "../../_ui/kit";
import { searchPlaces } from "./actions";

type Place = { label: string; lat: number; lng: number };

/** Type an address, pick from what OpenStreetMap finds. */
export function PlaceSearch({ onPick, placeholder = "Search an address or place" }: { onPick: (p: Place) => void; placeholder?: string }) {
  const run = useAdminAction();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Place[] | null>(null);

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await run(() => searchPlaces(q));
            setHits(r.ok ? r.data : []);
          });
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} minLength={3} maxLength={160} />
        <Button variant="secondary" disabled={pending || q.trim().length < 3}>
          {pending ? "Looking…" : "Find"}
        </Button>
      </form>
      {hits && (
        <ul className="mt-2 overflow-hidden rounded-xl shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button
                type="button"
                className="block w-full truncate px-3.5 py-2.5 text-left text-[13px] hover:bg-soft-mist/60"
                onClick={() => {
                  onPick(h);
                  setHits(null);
                }}
              >
                {h.label}
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="px-3.5 py-2.5 text-[13px] text-carbon/55">Nothing found. Try a street and area, or click the map.</li>}
        </ul>
      )}
    </div>
  );
}
