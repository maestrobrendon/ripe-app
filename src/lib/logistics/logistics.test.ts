import { describe, expect, it } from "vitest";
import { angleFrom, haversineKm, type LatLng } from "./geo";
import { priceDelivery, type PricingRules } from "./pricing";
import { arrivals, orderStops, planRoutes, type Matrix } from "./optimize";
import { directionsLinks } from "./routing";

const rules: PricingRules = { baseFee: 500, perKm: 150, includedKm: 2, minFee: 1000, maxFee: 6000, roundTo: 100 };

describe("distance pricing", () => {
  it("charges the base plus each km after the included ones, rounded up", () => {
    const p = priceDelivery(10, rules); // 500 + 8 x 150 = 1700
    expect(p.fee).toBe(1700);
    expect(priceDelivery(10.3, rules).fee).toBe(1800); // 1745 rounds up
  });
  it("keeps to the minimum and the maximum, and says why", () => {
    const short = priceDelivery(1, rules);
    expect(short.fee).toBe(1000);
    expect(short.notes.join()).toMatch(/minimum/);
    const far = priceDelivery(80, rules);
    expect(far.fee).toBe(6000);
    expect(far.notes.join()).toMatch(/Capped/);
  });
  it("treats no cap as no cap", () => {
    expect(priceDelivery(80, { ...rules, maxFee: 0 }).fee).toBe(12200);
  });
});

/** A grid town: points with straight-line travel, 1 km = 60 s. */
function town(points: LatLng[]): Matrix {
  const km = points.map((a) => points.map((b) => haversineKm(a, b)));
  return { km, sec: km.map((r) => r.map((d) => d * 60)) };
}
const depot = { lat: 6.5, lng: 3.35 };
const east = (k: number) => ({ lat: 6.5, lng: 3.35 + k * 0.01 });
const west = (k: number) => ({ lat: 6.5, lng: 3.35 - k * 0.01 });

describe("route planning", () => {
  it("visits stops along a road in order, whatever order they came in", () => {
    const pts = [depot, east(3), east(1), east(4), east(2)];
    const m = town(pts);
    const order = orderStops(m, [1, 2, 3, 4], false).map((i) => pts[i].lng);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("gives each vehicle one side of town", () => {
    const pts = [depot, east(1), west(1), east(2), west(2), east(3), west(3)];
    const plan = planRoutes({ matrix: town(pts), stops: [1, 2, 3, 4, 5, 6], vehicles: [{ capacity: 10 }, { capacity: 10 }], returnToDepot: false, angles: pts.map((p) => angleFrom(depot, p)) });
    const sides = plan.routes.map((r) => new Set(r.stops.map((i) => (pts[i].lng > depot.lng ? "E" : "W"))));
    expect(sides.every((s) => s.size === 1)).toBe(true);
    expect(plan.unassigned).toEqual([]);
  });

  it("never overloads a vehicle, and lists what didn't fit", () => {
    const pts = [depot, east(1), east(2), east(3), east(4)];
    const plan = planRoutes({ matrix: town(pts), stops: [1, 2, 3, 4], vehicles: [{ capacity: 3 }], returnToDepot: false });
    expect(plan.routes[0].stops).toHaveLength(3);
    expect(plan.unassigned).toHaveLength(1);
  });

  it("is no worse than the order the stops came in", () => {
    const pts = [depot, east(4), west(2), east(1), west(4), east(3), west(1)];
    const m = town(pts);
    const given = [1, 2, 3, 4, 5, 6];
    const cost = (s: number[]) => [0, ...s].slice(0, -1).reduce((t, a, i) => t + m.sec[a][[0, ...s][i + 1]], 0);
    expect(cost(orderStops(m, given, false))).toBeLessThanOrEqual(cost(given));
  });

  it("works out arrival times, allowing time at each stop", () => {
    const pts = [depot, east(1), east(2)];
    const plan = planRoutes({ matrix: town(pts), stops: [1, 2], vehicles: [{ capacity: 5 }], returnToDepot: false });
    const eta = arrivals(plan.routes[0], 5);
    expect(eta[1] - eta[0]).toBeGreaterThanOrEqual(5);
  });
});

describe("rider links", () => {
  it("splits long routes into Google Maps links of up to 9 stops in between", () => {
    const pts = Array.from({ length: 25 }, (_, i) => east(i));
    const links = directionsLinks(pts);
    expect(links.length).toBe(3);
    expect(links[0]).toContain("waypoints=");
  });
});

describe("stop order quality", () => {
  /** A random town, the same every run. */
  function randomTown(n: number, seed: number): Matrix {
    let x = seed;
    const r = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    const pts = Array.from({ length: n + 1 }, () => ({ lat: 6.4 + r() * 0.2, lng: 3.3 + r() * 0.3 }));
    // Lopsided like real roads: going one way can take longer than coming back.
    const m = town(pts);
    return { km: m.km, sec: m.sec.map((row, i) => row.map((v, j) => v * (i < j ? 1 : 1.25))) };
  }
  const cost = (m: Matrix, order: number[], back: boolean) => [0, ...order, ...(back ? [0] : [])].reduce((t, p, i, a) => (i ? t + m.sec[a[i - 1]][p] : 0), 0);
  function permutations(xs: number[]): number[][] {
    if (xs.length <= 1) return [xs];
    return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  }

  it("finds the exact best order for small routes, open or returning", () => {
    for (const seed of [3, 11, 42]) {
      const m = randomTown(7, seed);
      const stops = [1, 2, 3, 4, 5, 6, 7];
      for (const back of [false, true]) {
        const best = Math.min(...permutations(stops).map((p) => cost(m, p, back)));
        expect(cost(m, orderStops(m, stops, back), back)).toBeCloseTo(best, 6);
      }
    }
  });

  it("does at least as well as nearest-first on long routes, and the same every time", () => {
    const m = randomTown(30, 7);
    const stops = Array.from({ length: 30 }, (_, i) => i + 1);
    const a = orderStops(m, stops, false);
    expect(new Set(a).size).toBe(30);
    expect(orderStops(m, stops, false)).toEqual(a);
    // Nearest-first, by hand.
    const left = new Set(stops);
    const greedy: number[] = [];
    for (let at = 0; left.size; ) {
      const next = [...left].sort((p, q) => m.sec[at][p] - m.sec[at][q])[0];
      greedy.push(next);
      left.delete(next);
      at = next;
    }
    expect(cost(m, a, false)).toBeLessThan(cost(m, greedy, false));
  });
});
