import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/guard";
import { behaviour, behaviourConfigured, posthogProjectUrl } from "@/lib/admin/behaviour";
import { Card, PageHeader, cx } from "../../../_ui/kit";
import { BarList, ColumnChart, Stat } from "../../../_ui/charts";
import { one } from "../../../_ui/format";

export const metadata: Metadata = { title: "Behaviour" };

const RANGES = [7, 30, 90] as const;
const short = (ymd: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
const n = (x: number) => x.toLocaleString("en-NG");
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "1m 20s", "45s", "2h 5m". */
function duration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** The homepage and Home sections, named the way they read on screen. */
const SECTION_NAMES: Record<string, string> = {
  "home-hero": "Homepage · Hero",
  "home-what-arrives": "Homepage · What arrives",
  "home-recipes": "Homepage · This week's recipes",
  "home-how-it-works": "Homepage · How it works",
  "home-pricing": "Homepage · Pricing",
  "home-questions": "Homepage · Questions",
  "home-closing": "Homepage · Closing",
  "basket-hero": "Home · Basket card",
  "basket-cook-this-week": "Home · Cook this week",
  "basket-suggestions": "Home · Kachi suggests",
};

/** Google's thresholds for a good, fair and poor experience. */
function vitalTone(value: number | null, good: number, poor: number) {
  if (value === null) return "";
  return value <= good ? "text-[#0f7a48]" : value <= poor ? "text-[#b26b00]" : "text-ember";
}

export default async function BehaviourPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("insights.view");
  const asked = Number(one((await searchParams).days, 3));
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;

  if (!behaviourConfigured()) {
    return (
      <>
        <PageHeader title="Behaviour" description="How people use the site, from PostHog." />
        <Card>
          <p className="text-[14px]">PostHog isn&apos;t connected on this server yet. Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID.</p>
        </Card>
      </>
    );
  }

  const b = await behaviour(days);
  const o = b.overview;
  const f = b.funnel;
  const accepted = b.consent.granted ?? 0;
  const rejected = b.consent.denied ?? 0;

  return (
    <>
      <PageHeader
        title="Behaviour"
        description="How people use the site: where they go, what they tap, how long they stay, and where they give up. From PostHog, refreshed every five minutes. Counts only, no customer details."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex gap-1" aria-label="Period">
              {RANGES.map((r) => (
                <Link key={r} href={`/insights/behaviour?days=${r}`} aria-current={r === days ? "page" : undefined} className={cx("h-9 rounded-lg px-3 text-[13px] leading-9 font-semibold", r === days ? "bg-carbon text-paper-white" : "hover:bg-soft-mist/70")}>
                  {r} days
                </Link>
              ))}
            </nav>
            <a href={posthogProjectUrl("/replay/home")} target="_blank" rel="noopener noreferrer" className="h-9 rounded-lg bg-soft-mist px-3 text-[13px] leading-9 font-semibold hover:bg-soft-mist/70">
              Watch replays ↗
            </a>
            <a href={posthogProjectUrl("/heatmaps")} target="_blank" rel="noopener noreferrer" className="h-9 rounded-lg bg-soft-mist px-3 text-[13px] leading-9 font-semibold hover:bg-soft-mist/70">
              Heatmaps ↗
            </a>
          </div>
        }
      />

      {b.failed.length > 0 && (
        <p className="mb-4 rounded-xl bg-ember/10 px-4 py-2.5 text-[13px] text-ember">Some figures couldn&apos;t be loaded from PostHog just now ({b.failed.join(", ")}). Reload in a minute.</p>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visits" value={n(o.visits)} note={`${n(o.pageviews)} pages viewed`} />
        <Stat label="Typical visit" value={duration(o.medianVisitSeconds)} note={`Average ${duration(o.averageVisitSeconds)}`} />
        <Stat label="Left after one page" value={pct(o.bounceRate)} note="Visits that saw a single page" />
        <Stat label="Signed-in people tracked" value={n(o.signedIn)} note={`Cookies: ${n(accepted)} accepted · ${n(rejected)} rejected`} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Visits per day">
          <ColumnChart label="Visits per day" points={b.daily.map((p) => ({ key: p.day, value: p.visits, title: `${short(p.day)}: ${n(p.visits)} visits, ${n(p.views)} pages` }))} />
        </Card>
        <Card title="From visit to order">
          <Funnel
            steps={[
              { label: "Visited", value: f.visited },
              { label: "Added produce", value: f.added },
              { label: "Submitted checkout", value: f.submitted },
            ]}
          />
          {f.failed > 0 && <p className="mt-3 text-[12px] text-ember">{n(f.failed)} visits hit an error at checkout.</p>}
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Pages">
          <Table
            head={["Page", "Views", "Time on page"]}
            rows={b.pages.map((p) => [<code key="p" className="text-[12px]">{p.path}</code>, n(p.views), duration(p.seconds)])}
            empty="No page views yet."
          />
        </Card>
        <Card title="Where people stop and read">
          <p className="-mt-1 mb-3 text-[12px] text-carbon/55">Time each part of a page spent on screen. Long average = people slow down there.</p>
          <Table
            head={["Section", "Average", "Total"]}
            rows={b.sections.map((s) => [SECTION_NAMES[s.section] ?? s.section, duration(s.averageSeconds), duration(s.totalSeconds)])}
            empty="No section timings yet."
          />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Most tapped">
          <Table head={["Button or link", "Page", "Taps"]} rows={b.clicks.map((c) => [c.label, <code key="p" className="text-[12px]">{c.path}</code>, n(c.count)])} empty="No taps recorded yet." />
        </Card>
        <Card title="Recipes looked at">
          <BarList rows={b.recipePages.map((r) => ({ label: r.recipe.replace(/-/g, " "), value: r.views, note: `${n(r.visits)} visits` }))} empty="No recipe pages opened yet." />
          {(b.recipeOpened.length > 0 || b.recipeSaved.length > 0) && (
            <p className="mt-3 text-[12px] text-carbon/55">
              {n(b.recipeOpened.reduce((s, x) => s + x.count, 0))} opened from the homepage menu · {n(b.recipeSaved.reduce((s, x) => s + x.count, 0))} saved
            </p>
          )}
        </Card>
        <Card title="Produce added">
          <BarList rows={b.products.map((p) => ({ label: p.product, value: p.added, note: p.removed ? `${n(p.removed)} removed` : undefined }))} empty="Nothing added yet." />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Kachi">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <Fact label="Messages" value={n(b.kachi.messages)} />
            <Fact label="Chats" value={n(b.kachi.chats)} />
            <Fact label="Typical reply" value={b.kachi.p50 === null ? "—" : `${(b.kachi.p50 / 1000).toFixed(1)}s`} />
            <Fact label="Slowest 1 in 10" value={b.kachi.p90 === null ? "—" : `${(b.kachi.p90 / 1000).toFixed(1)}s`} />
            <Fact label="Replies that failed" value={n(b.kachi.failed)} />
            <Fact label="Changed a basket" value={n(b.kachi.changedBasket)} />
          </dl>
        </Card>
        <Card title="Speed on real devices">
          <p className="-mt-1 mb-3 text-[12px] text-carbon/55">What 3 in 4 visits get, or better. Colour follows Google&apos;s good / fair / poor marks.</p>
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <Fact label="Main content shows" value={b.vitals.lcp === null ? "—" : `${(b.vitals.lcp / 1000).toFixed(1)}s`} tone={vitalTone(b.vitals.lcp, 2500, 4000)} />
            <Fact label="First paint" value={b.vitals.fcp === null ? "—" : `${(b.vitals.fcp / 1000).toFixed(1)}s`} tone={vitalTone(b.vitals.fcp, 1800, 3000)} />
            <Fact label="Reacts to a tap" value={b.vitals.inp === null ? "—" : `${Math.round(b.vitals.inp)}ms`} tone={vitalTone(b.vitals.inp, 200, 500)} />
            <Fact label="Layout shift" value={b.vitals.cls === null ? "—" : b.vitals.cls.toFixed(2)} tone={vitalTone(b.vitals.cls, 0.1, 0.25)} />
          </dl>
        </Card>
        <Card title="Frustration">
          <p className="-mt-1 mb-3 text-[12px] text-carbon/55">Rapid repeat taps (rage) and taps that did nothing (dead), by page. Only from visitors who accepted analytics cookies.</p>
          <Table head={["Page", "Rage", "Dead"]} rows={b.friction.map((x) => [<code key="p" className="text-[12px]">{x.path}</code>, n(x.rage), n(x.dead)])} empty="No frustrated taps recorded." />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Devices">
          <BarList rows={b.devices.map((d) => ({ label: d.device, value: d.visits }))} empty="No visits yet." />
        </Card>
        <Card title="Where visits come from">
          <BarList rows={b.sources.map((s) => ({ label: s.source, value: s.visits }))} empty="No visits yet." />
        </Card>
      </div>
    </>
  );
}

function Fact({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-carbon/55">{label}</dt>
      <dd className={cx("mt-0.5 text-[18px] font-semibold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-[13px] text-carbon/50">{empty}</p>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11px] font-semibold tracking-[0.03em] text-carbon/45 uppercase">
          {head.map((h, i) => (
            <th key={h} className={cx("pb-2 font-semibold", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-black/5">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={cx("py-2", j > 0 ? "text-right tabular-nums text-carbon/70" : "max-w-0 truncate pr-3")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Each step as a bar against the first, with the share that made it through. */
function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums text-carbon/60">
              <b className="font-semibold text-carbon">{n(s.value)}</b>
              {i > 0 && ` · ${pct(s.value / top)}`}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-soft-mist">
            <div className="h-full rounded-full bg-carbon" style={{ width: `${Math.max(2, (s.value / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
