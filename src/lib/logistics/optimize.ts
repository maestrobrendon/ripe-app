/*
 * Route planning: which vehicle takes which stops, and in what order, so the
 * day's deliveries take the least time. Pure and standalone: it works on a
 * travel table (seconds and kilometres between every pair of points, index 0
 * being the depot) from any routing source.
 *
 * How it plans:
 *   1. Several vehicles: stops are grouped by direction from the depot (a
 *      "sweep"), so each vehicle covers one side of town, within its capacity.
 *   2. Each group is put in order. Up to 12 stops: the exact best order
 *      (Held-Karp). More: several starting orders (nearest-first, cheapest
 *      insertion), each improved with 2-opt (undo any crossing) and or-opt
 *      (move a stop, or a run of up to three, to a better place), then an
 *      iterated local search that shakes the best one up and improves it
 *      again, keeping whatever is shorter. Seeded, so the same day always
 *      plans the same way.
 *   3. Stops are then moved between vehicles whenever that shortens the day,
 *      balancing total driving against the longest single route, and each
 *      route is improved again.
 *   4. If there's more to deliver than room, the stops left out are the ones
 *      that cost the most to fit in.
 */

export type Matrix = { sec: number[][]; km: number[][] };
export type Vehicle = { capacity: number };
export type Leg = { sec: number; km: number };
export type PlannedRoute = { stops: number[]; sec: number; km: number; legs: Leg[] };
export type Plan = { routes: PlannedRoute[]; unassigned: number[]; sec: number; km: number };

export type PlanInput = {
  matrix: Matrix;
  /** Point indices to visit (1..n; 0 is the depot). */
  stops: number[];
  vehicles: Vehicle[];
  /** Come back to the depot at the end of each route. */
  returnToDepot: boolean;
  /** Direction of each point from the depot, by index, for grouping. */
  angles?: number[];
};

const path = (stops: number[], back: boolean) => [0, ...stops, ...(back ? [0] : [])];

function routeSec(m: Matrix, stops: number[], back: boolean) {
  const p = path(stops, back);
  let s = 0;
  for (let i = 0; i < p.length - 1; i++) s += m.sec[p[i]][p[i + 1]];
  return s;
}

function describe(m: Matrix, stops: number[], back: boolean): PlannedRoute {
  const p = path(stops, back);
  const legs: Leg[] = [];
  for (let i = 0; i < p.length - 1; i++) legs.push({ sec: m.sec[p[i]][p[i + 1]], km: m.km[p[i]][p[i + 1]] });
  return { stops, legs, sec: legs.reduce((s, l) => s + l.sec, 0), km: legs.reduce((s, l) => s + l.km, 0) };
}

/** Nearest stop next, from the depot. */
function nearestFirst(m: Matrix, stops: number[]): number[] {
  const left = new Set(stops);
  const out: number[] = [];
  let at = 0;
  while (left.size) {
    let best = -1;
    let bestSec = Infinity;
    for (const s of left) if (m.sec[at][s] < bestSec) {
      bestSec = m.sec[at][s];
      best = s;
    }
    out.push(best);
    left.delete(best);
    at = best;
  }
  return out;
}

/** Reverse any stretch of the route that makes it shorter (removes crossings). */
function twoOpt(m: Matrix, stops: number[], back: boolean): number[] {
  let best = stops.slice();
  let bestSec = routeSec(m, best, back);
  for (let pass = 0, improved = true; improved && pass < 50; pass++) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const next = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const sec = routeSec(m, next, back);
        if (sec + 1e-9 < bestSec) {
          best = next;
          bestSec = sec;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Move one stop, or a run of up to three, to wherever it fits best. */
function orOpt(m: Matrix, stops: number[], back: boolean): number[] {
  let best = stops.slice();
  let bestSec = routeSec(m, best, back);
  for (let pass = 0, improved = true; improved && pass < 50; pass++) {
    improved = false;
    for (let len = 1; len <= 3; len++) {
      for (let i = 0; i + len <= best.length; i++) {
        const seg = best.slice(i, i + len);
        const rest = [...best.slice(0, i), ...best.slice(i + len)];
        for (let k = 0; k <= rest.length; k++) {
          if (k === i) continue;
          const next = [...rest.slice(0, k), ...seg, ...rest.slice(k)];
          const sec = routeSec(m, next, back);
          if (sec + 1e-9 < bestSec) {
            best = next;
            bestSec = sec;
            improved = true;
          }
        }
      }
    }
  }
  return best;
}

/** Twice-improved until neither move helps. */
function improve(m: Matrix, stops: number[], back: boolean): number[] {
  let s = stops;
  for (let i = 0; i < 6; i++) {
    const before = routeSec(m, s, back);
    s = orOpt(m, twoOpt(m, s, back), back);
    if (routeSec(m, s, back) >= before - 1e-9) break;
  }
  return s;
}

/** Grow the route by adding whichever stop costs least to fit in, where it fits best. */
function cheapestInsertion(m: Matrix, stops: number[], back: boolean): number[] {
  const left = new Set(stops);
  let route: number[] = [];
  while (left.size) {
    let best: number[] | null = null;
    let bestSec = Infinity;
    let pick = -1;
    for (const st of left) {
      for (let k = 0; k <= route.length; k++) {
        const r = [...route.slice(0, k), st, ...route.slice(k)];
        const sec = routeSec(m, r, back);
        if (sec < bestSec) {
          bestSec = sec;
          best = r;
          pick = st;
        }
      }
    }
    route = best!;
    left.delete(pick);
  }
  return route;
}

/** The exact shortest order (dynamic programming over subsets): fine up to a dozen stops. */
function exactOrder(m: Matrix, stops: number[], back: boolean): number[] {
  const n = stops.length;
  const full = 1 << n;
  const cost = new Float64Array(full * n).fill(Infinity);
  const from = new Int16Array(full * n).fill(-1);
  for (let j = 0; j < n; j++) cost[(1 << j) * n + j] = m.sec[0][stops[j]];
  for (let mask = 1; mask < full; mask++) {
    for (let j = 0; j < n; j++) {
      const here = cost[mask * n + j];
      if (!(mask & (1 << j)) || here === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const next = mask | (1 << k);
        const c = here + m.sec[stops[j]][stops[k]];
        if (c < cost[next * n + k]) {
          cost[next * n + k] = c;
          from[next * n + k] = j;
        }
      }
    }
  }
  let end = 0;
  let best = Infinity;
  for (let j = 0; j < n; j++) {
    const c = cost[(full - 1) * n + j] + (back ? m.sec[stops[j]][0] : 0);
    if (c < best) {
      best = c;
      end = j;
    }
  }
  const order: number[] = [];
  for (let mask = full - 1, j = end; j >= 0; ) {
    order.push(stops[j]);
    const prev = from[mask * n + j];
    mask &= ~(1 << j);
    j = prev;
  }
  return order.reverse();
}

/** A small, repeatable random source. */
function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/** Cut the route in four and swap the middle pieces: a kick 2-opt and or-opt can't undo on their own. */
function doubleBridge(stops: number[], rand: () => number): number[] {
  const n = stops.length;
  const a = 1 + Math.floor(rand() * (n - 3));
  const b = a + 1 + Math.floor(rand() * (n - a - 2));
  const c = b + 1 + Math.floor(rand() * (n - b - 1));
  return [...stops.slice(0, a), ...stops.slice(b, c), ...stops.slice(a, b), ...stops.slice(c)];
}

/** Up to this many stops, the exact best order is found. */
const EXACT_UP_TO = 12;

/** The best order for one vehicle's stops. */
export function orderStops(m: Matrix, stops: number[], back: boolean): number[] {
  if (stops.length <= 1) return stops.slice();
  if (stops.length <= EXACT_UP_TO) return exactOrder(m, stops, back);

  let best = [nearestFirst(m, stops), cheapestInsertion(m, stops, back)].map((s) => improve(m, s, back)).sort((a, b) => routeSec(m, a, back) - routeSec(m, b, back))[0];
  let bestSec = routeSec(m, best, back);
  const rand = seeded(stops.reduce((h, x) => Math.imul(h ^ x, 2654435761), 7));
  // More shakes for short routes, fewer for long ones, so planning stays quick.
  const tries = Math.max(10, Math.min(60, Math.round(1500 / stops.length)));
  for (let t = 0; t < tries; t++) {
    const next = improve(m, doubleBridge(best, rand), back);
    const sec = routeSec(m, next, back);
    if (sec + 1e-9 < bestSec) {
      best = next;
      bestSec = sec;
    }
  }
  return best;
}

/** Group stops by direction from the depot, starting after the widest empty gap, within capacities. */
function sweep(stops: number[], angles: number[], vehicles: Vehicle[]): { groups: number[][]; unassigned: number[] } {
  const sorted = [...stops].sort((a, b) => angles[a] - angles[b]);
  let start = 0;
  let widest = -1;
  for (let i = 0; i < sorted.length; i++) {
    const a = angles[sorted[i]];
    const prev = angles[sorted[(i - 1 + sorted.length) % sorted.length]];
    const gap = (a - prev + 2 * Math.PI) % (2 * Math.PI);
    if (gap > widest) {
      widest = gap;
      start = i;
    }
  }
  const ring = [...sorted.slice(start), ...sorted.slice(0, start)];
  const groups: number[][] = vehicles.map(() => []);
  let at = 0;
  for (let v = 0; v < vehicles.length && at < ring.length; v++) {
    const remaining = ring.length - at;
    const share = Math.ceil(remaining / (vehicles.length - v));
    const take = Math.min(share, vehicles[v].capacity);
    groups[v] = ring.slice(at, at + take);
    at += take;
  }
  return { groups, unassigned: ring.slice(at) };
}

/** Total driving plus the longest route: short overall, and no one rider stuck with the whole day. */
const objective = (secs: number[]) => secs.reduce((a, b) => a + b, 0) + Math.max(0, ...secs);

/** Move stops between vehicles while it makes the day shorter. */
function rebalance(m: Matrix, groups: number[][], vehicles: Vehicle[], back: boolean): number[][] {
  let g = groups.map((x) => x.slice());
  let secs = g.map((s) => routeSec(m, s, back));
  for (let pass = 0, improved = true; improved && pass < 20; pass++) {
    improved = false;
    for (let from = 0; from < g.length; from++) {
      for (let i = 0; i < g[from].length; i++) {
        const stop = g[from][i];
        const without = [...g[from].slice(0, i), ...g[from].slice(i + 1)];
        const withoutSec = routeSec(m, without, back);
        for (let to = 0; to < g.length; to++) {
          if (to === from || g[to].length >= vehicles[to].capacity) continue;
          // Best place for it on the other route.
          let bestRoute: number[] | null = null;
          let bestSec = Infinity;
          for (let k = 0; k <= g[to].length; k++) {
            const r = [...g[to].slice(0, k), stop, ...g[to].slice(k)];
            const sec = routeSec(m, r, back);
            if (sec < bestSec) {
              bestSec = sec;
              bestRoute = r;
            }
          }
          const trial = secs.slice();
          trial[from] = withoutSec;
          trial[to] = bestSec;
          if (bestRoute && objective(trial) + 1e-9 < objective(secs)) {
            g[from] = without;
            g[to] = bestRoute;
            secs = trial;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
      if (improved) break;
    }
    if (improved) g = g.map((s) => orderStops(m, s, back));
    secs = g.map((s) => routeSec(m, s, back));
  }
  return g;
}

/** Best place to slip one stop into a route, and the route's time with it. */
function bestInsert(m: Matrix, route: number[], stop: number, back: boolean): { route: number[]; sec: number } {
  let best = [...route, stop];
  let bestSec = routeSec(m, best, back);
  for (let k = 0; k < route.length; k++) {
    const r = [...route.slice(0, k), stop, ...route.slice(k)];
    const sec = routeSec(m, r, back);
    if (sec < bestSec) {
      bestSec = sec;
      best = r;
    }
  }
  return { route: best, sec: bestSec };
}

/**
 * When not every stop fits: swap a left-out stop for one on a route whenever
 * that makes the day shorter, so the stops left for later are the ones that
 * would bend a route out of shape, not just the last ones in the sweep.
 */
function chooseLeftOut(m: Matrix, groups: number[][], left: number[], back: boolean): { groups: number[][]; left: number[] } {
  const g = groups.map((x) => x.slice());
  const out = left.slice();
  let secs = g.map((r) => routeSec(m, r, back));
  for (let pass = 0, improved = true; improved && pass < 10; pass++) {
    improved = false;
    for (let u = 0; u < out.length && !improved; u++) {
      for (let r = 0; r < g.length && !improved; r++) {
        for (let i = 0; i < g[r].length; i++) {
          const without = [...g[r].slice(0, i), ...g[r].slice(i + 1)];
          const trial = bestInsert(m, without, out[u], back);
          const next = secs.slice();
          next[r] = trial.sec;
          if (objective(next) + 1e-9 < objective(secs)) {
            const dropped = g[r][i];
            g[r] = orderStops(m, trial.route, back);
            out[u] = dropped;
            secs = g.map((x) => routeSec(m, x, back));
            improved = true;
            break;
          }
        }
      }
    }
  }
  return { groups: g, left: out };
}

export function planRoutes(input: PlanInput): Plan {
  const { matrix: m, stops, vehicles, returnToDepot: back } = input;
  if (!vehicles.length) return { routes: [], unassigned: stops.slice(), sec: 0, km: 0 };
  const angles = input.angles ?? stops.map(() => 0);

  let groups: number[][];
  let unassigned: number[] = [];
  if (vehicles.length === 1) {
    groups = [stops.slice(0, vehicles[0].capacity)];
    unassigned = stops.slice(vehicles[0].capacity);
  } else {
    ({ groups, unassigned } = sweep(stops, angles, vehicles));
  }
  groups = groups.map((s) => orderStops(m, s, back));
  if (vehicles.length > 1) groups = rebalance(m, groups, vehicles, back);
  if (unassigned.length) ({ groups, left: unassigned } = chooseLeftOut(m, groups, unassigned, back));

  const routes = groups.map((s) => describe(m, s, back));
  return { routes, unassigned, sec: routes.reduce((a, r) => a + r.sec, 0), km: routes.reduce((a, r) => a + r.km, 0) };
}

/** Arrival time at each stop, in minutes from the start, allowing `serviceMin` at each one. */
export function arrivals(route: PlannedRoute, serviceMin: number): number[] {
  const out: number[] = [];
  let t = 0;
  route.stops.forEach((_, i) => {
    t += route.legs[i].sec / 60;
    out.push(Math.round(t));
    t += serviceMin;
  });
  return out;
}
