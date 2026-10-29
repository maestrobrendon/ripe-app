import "server-only";
import { BEHAVIOUR_QUERIES, type BehaviourQuery } from "./behaviour-queries";

/*
 * Insights → Behaviour, read from PostHog's query API with a personal key
 * (POSTHOG_PERSONAL_API_KEY, read-only) for one project (POSTHOG_PROJECT_ID).
 * Answers are cached for five minutes, so the page is quick and PostHog's
 * query limits are never close. Customers' names and emails are never asked
 * for here: every query is a count, an average or a label.
 */

const API = "https://us.posthog.com";
export const POSTHOG_APP = "https://us.posthog.com";

export function behaviourConfigured() {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

export function posthogProjectUrl(path = "") {
  return `${POSTHOG_APP}/project/${process.env.POSTHOG_PROJECT_ID}${path}`;
}

type Row = (string | number | boolean | null)[];

async function run(name: BehaviourQuery, days: number): Promise<Row[]> {
  const res = await fetch(`${API}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: BEHAVIOUR_QUERIES[name](days) }, name: `admin-behaviour-${name}` }),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`PostHog ${name}: ${res.status}`);
  const j = (await res.json()) as { results?: Row[] };
  return j.results ?? [];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown, fallback = "(none)") => (v === null || v === undefined || v === "" ? fallback : String(v));

export async function behaviour(days: number) {
  const names = Object.keys(BEHAVIOUR_QUERIES) as BehaviourQuery[];
  const settled = await Promise.allSettled(names.map((n) => run(n, days)));
  const r = Object.fromEntries(names.map((n, i) => [n, settled[i].status === "fulfilled" ? settled[i].value : []])) as Record<BehaviourQuery, Row[]>;
  const failed = names.filter((_, i) => settled[i].status === "rejected");

  const [ov] = r.overview;
  const [len] = r.visitLength;
  const [k] = r.kachi;
  const [f] = r.funnel;
  const [v] = r.vitals;

  const timeByPath = new Map(r.timeOnPage.map((x) => [str(x[0]), num(x[1])]));
  const actions = (event: string) => r.recipeActions.filter((x) => x[0] === event).map((x) => ({ recipe: str(x[1]), count: num(x[2]) }));

  return {
    failed,
    overview: {
      visits: num(ov?.[0]),
      pageviews: num(ov?.[1]),
      signedIn: num(ov?.[2]),
      taps: num(ov?.[3]),
      medianVisitSeconds: num(len?.[0]),
      averageVisitSeconds: num(len?.[1]),
      bounceRate: num(len?.[2]),
    },
    daily: r.daily.map((x) => ({ day: str(x[0]), visits: num(x[1]), views: num(x[2]) })),
    pages: r.pages.map((x) => ({ path: str(x[0]), views: num(x[1]), visits: num(x[2]), seconds: timeByPath.get(str(x[0])) ?? null })),
    sections: r.sections.map((x) => ({ section: str(x[0]), totalSeconds: num(x[1]), averageSeconds: num(x[2]), views: num(x[3]) })),
    clicks: r.clicks.map((x) => ({ label: str(x[0]).slice(0, 60), path: str(x[1]), count: num(x[2]) })),
    recipePages: r.recipePages.map((x) => ({ recipe: str(x[0]), views: num(x[1]), visits: num(x[2]) })),
    recipeOpened: actions("recipe_opened"),
    recipeSaved: actions("recipe_saved"),
    products: r.products.map((x) => ({ product: str(x[0]), added: num(x[1]), removed: num(x[2]) })),
    kachi: { messages: num(k?.[0]), chats: num(k?.[1]), p50: k?.[2] == null ? null : num(k[2]), p90: k?.[3] == null ? null : num(k[3]), failed: num(k?.[4]), changedBasket: num(k?.[5]) },
    funnel: { visited: num(f?.[0]), added: num(f?.[1]), submitted: num(f?.[2]), failed: num(f?.[3]) },
    devices: r.devices.map((x) => ({ device: str(x[0]), visits: num(x[1]) })),
    sources: r.sources.map((x) => ({ source: str(x[0]), visits: num(x[1]) })),
    vitals: { lcp: v?.[0] == null ? null : num(v[0]), inp: v?.[1] == null ? null : num(v[1]), cls: v?.[2] == null ? null : num(v[2]), fcp: v?.[3] == null ? null : num(v[3]) },
    friction: r.friction.map((x) => ({ path: str(x[0]), rage: num(x[1]), dead: num(x[2]) })),
    consent: Object.fromEntries(r.consent.map((x) => [str(x[0]), num(x[1])])) as Record<string, number>,
  };
}
