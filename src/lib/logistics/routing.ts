import { haversineKm, type LatLng } from "./geo";
import type { Matrix } from "./optimize";

/*
 * Road distances and times, from an OSRM server (the open-source routing
 * engine that runs on OpenStreetMap data). OSRM_URL picks the server; the
 * default is the free public demo, fine for testing and light use. For
 * production, run your own (one Docker container with the Nigeria extract)
 * and point OSRM_URL at it.
 *
 * If the server can't be reached, everything falls back to straight-line
 * distance times a road factor, at an average city speed, and says so
 * (`approximate: true`), so planning never stops working.
 */

export type RouteResult = {
  km: number;
  min: number;
  /** The road line to draw, as [lat, lng] pairs. */
  line: [number, number][];
  legs: { km: number; min: number }[];
  approximate: boolean;
};

export type RoutingOptions = {
  baseUrl?: string;
  /** Road km per straight-line km, when estimating. */
  roadFactor?: number;
  /** Average speed when estimating, km/h (Lagos traffic). */
  speedKmh?: number;
  timeoutMs?: number;
};

const DEMO = "https://router.project-osrm.org";
const coords = (points: LatLng[]) => points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");

function estimateMatrix(points: LatLng[], o: Required<RoutingOptions>): Matrix {
  const km = points.map((a) => points.map((b) => haversineKm(a, b) * o.roadFactor));
  return { km, sec: km.map((row) => row.map((d) => (d / o.speedKmh) * 3600)) };
}

const withDefaults = (o: RoutingOptions = {}): Required<RoutingOptions> => ({
  baseUrl: (o.baseUrl || DEMO).replace(/\/+$/, ""),
  roadFactor: o.roadFactor ?? 1.35,
  speedKmh: o.speedKmh ?? 22,
  timeoutMs: o.timeoutMs ?? 9000,
});

/** Travel times and distances between every pair of points (the planner's input). */
export async function travelTable(points: LatLng[], opts?: RoutingOptions): Promise<Matrix & { approximate: boolean }> {
  const o = withDefaults(opts);
  if (points.length < 2) return { ...estimateMatrix(points, o), approximate: false };
  try {
    const res = await fetch(`${o.baseUrl}/table/v1/driving/${coords(points)}?annotations=duration,distance`, { signal: AbortSignal.timeout(o.timeoutMs), cache: "no-store" });
    const data = (await res.json()) as { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
    if (!res.ok || data.code !== "Ok" || !data.durations || !data.distances) throw new Error(data.code ?? `HTTP ${res.status}`);
    const est = estimateMatrix(points, o);
    // A pair OSRM couldn't route (null) keeps the estimate for that pair.
    return {
      sec: data.durations.map((row, i) => row.map((v, j) => (v == null ? est.sec[i][j] : v))),
      km: data.distances.map((row, i) => row.map((v, j) => (v == null ? est.km[i][j] : v / 1000))),
      approximate: false,
    };
  } catch {
    return { ...estimateMatrix(points, o), approximate: true };
  }
}

/** The road route through points in this order, with its line to draw. */
export async function routeThrough(points: LatLng[], opts?: RoutingOptions): Promise<RouteResult> {
  const o = withDefaults(opts);
  const estimate = (): RouteResult => {
    const legs = points.slice(1).map((p, i) => {
      const km = haversineKm(points[i], p) * o.roadFactor;
      return { km, min: (km / o.speedKmh) * 60 };
    });
    return { km: legs.reduce((s, l) => s + l.km, 0), min: legs.reduce((s, l) => s + l.min, 0), line: points.map((p) => [p.lat, p.lng]), legs, approximate: true };
  };
  if (points.length < 2) return { ...estimate(), approximate: false };
  try {
    const res = await fetch(`${o.baseUrl}/route/v1/driving/${coords(points)}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout(o.timeoutMs), cache: "no-store" });
    const data = (await res.json()) as {
      code?: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { distance: number; duration: number }[] }[];
    };
    const r = data.routes?.[0];
    if (!res.ok || data.code !== "Ok" || !r) throw new Error(data.code ?? `HTTP ${res.status}`);
    return {
      km: r.distance / 1000,
      min: r.duration / 60,
      line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: r.legs.map((l) => ({ km: l.distance / 1000, min: l.duration / 60 })),
      approximate: false,
    };
  } catch {
    return estimate();
  }
}

/** Road distance from one point to another, in km. */
export async function roadKm(from: LatLng, to: LatLng, opts?: RoutingOptions) {
  const r = await routeThrough([from, to], opts);
  return { km: r.km, min: r.min, approximate: r.approximate };
}

/**
 * A Google Maps directions link a rider can open on their phone (free, no
 * key). Google takes at most 9 stops in between, so longer routes are split.
 */
export function directionsLinks(points: LatLng[]): string[] {
  const at = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const links: string[] = [];
  for (let i = 0; i < points.length - 1; i += 10) {
    const chunk = points.slice(i, i + 11);
    const origin = chunk[0];
    const dest = chunk[chunk.length - 1];
    const via = chunk.slice(1, -1).map(at).join("|");
    links.push(`https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${at(origin)}&destination=${at(dest)}${via ? `&waypoints=${encodeURIComponent(via)}` : ""}`);
  }
  return links;
}
