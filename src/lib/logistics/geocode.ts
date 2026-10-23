import type { LatLng } from "./geo";

/*
 * Turning addresses into map points (and back), with OpenStreetMap's free
 * Nominatim service. Its rules: at most one request a second, a real
 * User-Agent, and results cached rather than looked up again. So this waits
 * its turn, and callers store what it finds.
 *
 * Lagos addresses are often missing from OpenStreetMap, so a result can be
 * near rather than exact. Where the price depends on it, the customer
 * confirms the spot by dropping a pin instead.
 */

export type GeoHit = LatLng & { label: string };

export type GeocodeOptions = {
  baseUrl?: string;
  /** Who's asking, as Nominatim requires: "Basket/1.0 (hello@getbasket.ng)". */
  userAgent: string;
  /** ISO country codes to search in, e.g. "ng". */
  countryCodes?: string;
  /** Prefer results in this box: [west, north, east, south]. */
  viewbox?: [number, number, number, number];
};

const NOMINATIM = "https://nominatim.openstreetmap.org";
let last = 0;

/** One request a second, across the whole process. */
async function turn() {
  const wait = last + 1100 - Date.now();
  last = Math.max(Date.now(), last + 1100);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function geocode(query: string, o: GeocodeOptions): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  await turn();
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "5", addressdetails: "0" });
  if (o.countryCodes) params.set("countrycodes", o.countryCodes);
  if (o.viewbox) params.set("viewbox", o.viewbox.join(","));
  try {
    const res = await fetch(`${o.baseUrl ?? NOMINATIM}/search?${params}`, { headers: { "User-Agent": o.userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return [];
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return [];
  }
}

export async function reverseGeocode(p: LatLng, o: GeocodeOptions): Promise<string | null> {
  await turn();
  try {
    const params = new URLSearchParams({ lat: String(p.lat), lon: String(p.lng), format: "jsonv2", zoom: "18" });
    const res = await fetch(`${o.baseUrl ?? NOMINATIM}/reverse?${params}`, { headers: { "User-Agent": o.userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const row = (await res.json()) as { display_name?: string };
    return row.display_name ?? null;
  } catch {
    return null;
  }
}
