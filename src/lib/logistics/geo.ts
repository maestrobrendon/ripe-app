/*
 * Basic geography for the logistics engine. Pure functions, no dependencies:
 * this folder (src/lib/logistics) is written to stand alone, so it can be
 * lifted out and shipped as its own product.
 */

export type LatLng = { lat: number; lng: number };

const R = 6371; // Earth's radius, km

/** Straight-line distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The direction from one point to another, in radians (for grouping stops around a depot). */
export function angleFrom(origin: LatLng, p: LatLng): number {
  return Math.atan2(p.lat - origin.lat, (p.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180));
}

export const isLatLng = (p: unknown): p is LatLng =>
  Boolean(p) && typeof (p as LatLng).lat === "number" && typeof (p as LatLng).lng === "number" && Math.abs((p as LatLng).lat) <= 90 && Math.abs((p as LatLng).lng) <= 180;

/** Round to about 1 m, enough for any address and kind to URLs and caches. */
export const roundCoord = (n: number) => Math.round(n * 1e5) / 1e5;
