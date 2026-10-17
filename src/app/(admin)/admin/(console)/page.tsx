import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Permission, type Role } from "@/lib/admin/permissions";
import { overview, OVERVIEW_RANGES, type Overview } from "@/lib/admin/overview";
import { STATUS_LABEL } from "@/lib/order-status";
import { formatQty } from "@/lib/stock-core";
import { Badge, cx } from "../_ui/kit";
import { AreaChart, compactNaira, Delta, Donut, Gauge, HighlightBars, SegmentBar, Sparkline, TickBar } from "../_ui/dash";
import { naira, one, orderRef, statusTone } from "../_ui/format";
import { Icon, type IconName } from "../_ui/icons";

export const metadata: Metadata = { title: "Overview" };

const TZ = "Africa/Lagos";
const short = (ymd: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
const count = (n: number) => n.toLocaleString("en-NG");

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The white tile every dashboard section sits in. */
function Panel({ title, icon, action, children, className }: { title: ReactNode; icon?: IconName; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("animate-[admin-rise_0.5s_ease-out_both] rounded-[22px] bg-paper-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.04)] sm:p-6", className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
          {icon && (
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f1f3ef] text-carbon/70">
              <Icon name={icon} className="h-4 w-4" />
            </span>
          )}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-carbon/55 hover:bg-[#f1f3ef] hover:text-carbon">
      {label}
      <Icon name="arrow" className="h-3.5 w-3.5" />
    </Link>
  );
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff } = await requireStaffPage("dashboard.view");
  const role = staff.role as Role;
  const allowed = (p: Permission) => can(role, p);
  const asked = Number(one((await searchParams).days, 3));
  const days = (OVERVIEW_RANGES as readonly number[]).includes(asked) ? asked : 30;
  const d = await overview(days);
  const first = staff.name.split(/\s+/)[0];
  const dateLine = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date());

  const summary = [
    d.today.toPack ? `${d.today.toPack} order${d.today.toPack === 1 ? "" : "s"} to pack` : "nothing waiting to be packed",
    d.today.outForDelivery ? `${d.today.outForDelivery} out on the road` : null,
    d.stock.low ? `${d.stock.low} product${d.stock.low === 1 ? "" : "s"} running low` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {/* ── Hero and calendar ─────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="relative animate-[admin-rise_0.5s_ease-out_both] overflow-hidden rounded-[26px] bg-[linear-gradient(120deg,#d8f6e6_0%,#eef9f3_45%,#e6f1ff_100%)] p-6 sm:p-8">
          <HeroArt />
          <div className="relative max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-paper-white/70 px-3 py-1 text-[12px] font-semibold text-carbon/60 backdrop-blur">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {dateLine} · Lagos
            </p>
            <h1 className="mt-4 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">
              {greeting()},
              <br />
              {first}
            </h1>
            <p className="mt-3 text-[15px] text-carbon/60">Today: {summary.join(", ")}.</p>
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TodayTile tone="bg-paper-white/85" chip="bg-mint-pop text-carbon" icon="cart" label="Orders today" value={count(d.today.orders)} note="Since midnight" href={allowed("orders.view") ? "/orders" : undefined} />
            <TodayTile tone="bg-paper-white/85" chip="bg-lavender text-carbon" icon="cash" label="Paid today" value={naira(d.today.paid)} note="Test-mode payments" />
            <TodayTile tone="bg-paper-white/85" chip="bg-sunburst text-carbon" icon="box" label="To pack" value={count(d.today.toPack)} note="Confirmed or picking" href={allowed("fulfilment.view") ? "/fulfilment" : undefined} />
            <TodayTile tone="bg-paper-white/85" chip="bg-sky-wash text-[#1d4f86]" icon="truck" label="Out for delivery" value={count(d.today.outForDelivery)} note={`${d.today.delivered} delivered today`} href={allowed("delivery.view") ? "/delivery" : undefined} />
          </div>
        </section>

        <DeliveryCalendar cal={d.calendar} />
      </div>

      {/* ── Period KPIs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Performance</h2>
          <p className="text-[13px] text-carbon/50">Paid orders, last {days} days, against the {days} days before.</p>
        </div>
        <nav className="flex rounded-full bg-paper-white p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]" aria-label="Period">
          {OVERVIEW_RANGES.map((r) => (
            <Link
              key={r}
              href={`/?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={cx("h-8 rounded-full px-4 text-[13px] leading-8 font-semibold transition-colors", r === days ? "bg-carbon text-paper-white" : "text-carbon/55 hover:text-carbon")}
            >
              {r}D
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi id="k-rev" icon="cash" chip="bg-mint-pop/35" label="Revenue" value={naira(d.kpi.revenue.value)} change={d.kpi.revenue.change} spark={d.kpi.revenue.spark} dark />
        <Kpi id="k-ord" icon="orders" chip="bg-sky-wash" label="Orders" value={count(d.kpi.orders.value)} change={d.kpi.orders.change} spark={d.kpi.orders.spark} stroke="#1d6fd1" fill="#4da2ff" />
        <Kpi id="k-avg" icon="cart" chip="bg-lavender" label="Average order" value={naira(d.kpi.average.value)} change={d.kpi.average.change} spark={d.kpi.average.spark} stroke="#5c4ade" fill="#b9a8ff" />
        <Kpi id="k-cus" icon="users" chip="bg-sunburst/60" label="New customers" value={count(d.kpi.customers.value)} change={d.kpi.customers.change} spark={d.kpi.customers.spark} stroke="#b07a00" fill="#ffd731" />
      </div>

      {/* ── Revenue and pipeline ──────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel
          title="Revenue"
          icon="chart"
          action={allowed("insights.view") ? <ViewAll href={`/insights?days=${days}`} label="Insights" /> : undefined}
        >
          <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="text-[34px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{naira(d.kpi.revenue.value)}</p>
            <Delta value={d.kpi.revenue.change} />
            <p className="text-[12px] text-carbon/45">vs previous {days} days · {count(d.kpi.orders.value)} orders</p>
          </div>
          <AreaChart
            id="rev-area"
            label="Revenue per day"
            format={naira}
            axisFormat={compactNaira}
            points={d.series.map((p) => ({ key: p.day, label: short(p.day), value: p.revenue, note: `${p.orders} order${p.orders === 1 ? "" : "s"}` }))}
          />
        </Panel>

        <Panel title="Order pipeline" icon="orders" action={allowed("orders.view") ? <ViewAll href="/orders" /> : undefined}>
          <Pipeline d={d} />
        </Panel>
      </div>

      {/* ── Rhythm, members, stock ────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Busiest days" icon="calendar">
          <HighlightBars label="Orders by weekday" values={d.weekdays} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} format={(n) => `${n} order${n === 1 ? "" : "s"}`} />
          <p className="mt-4 text-[12px] text-carbon/50">Orders placed on each weekday over the last {days} days.</p>
        </Panel>

        <Panel title="Membership" icon="badge" action={allowed("subscriptions.view") ? <ViewAll href="/subscriptions" /> : undefined}>
          <Gauge
            value={d.members.customers ? d.members.members / d.members.customers : 0}
            center={`${d.members.customers ? Math.round((d.members.members / d.members.customers) * 100) : 0}%`}
            sub="of customers are members"
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat label="Members" value={count(d.members.members)} note={`${d.members.joined} joined · ${d.members.cancelled} left`} />
            <MiniStat label="Plans a month" value={compactNaira(d.members.monthlyRevenue)} note={`${d.members.pending} awaiting payment`} />
          </div>
        </Panel>

        <Panel title="Stock health" icon="stock" action={allowed("inventory.view") ? <ViewAll href="/inventory" /> : undefined} className="lg:col-span-2 xl:col-span-1">
          <SegmentBar
            segments={[
              { label: "Healthy", value: d.stock.healthy, color: "#55db9c" },
              { label: "Running low", value: d.stock.low, color: "#ffd731" },
              { label: "Out", value: d.stock.out, color: "#fb4903" },
              { label: "Not tracked", value: d.stock.untracked, color: "#cfd5c8" },
            ]}
          />
          <div className="mt-5 border-t border-black/5 pt-4">
            {d.stock.lowList.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-carbon/55">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-mint-pop/30 text-[#0b5a35]">✓</span>
                Nothing at or under its reorder point.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {d.stock.lowList.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 text-[13px]">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f6f3e4] text-[16px]" aria-hidden>
                      {p.imageEmoji}
                    </span>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-carbon/50 tabular-nums">
                      {formatQty(p.stockOnHand, p.soldAs)} / {formatQty(p.reorderPoint ?? 0, p.soldAs)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Recent orders and quick actions ───────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {allowed("orders.view") ? (
          <Panel title="Recent orders" icon="orders" action={<ViewAll href="/orders" />}>
            <RecentOrders rows={d.recent} />
          </Panel>
        ) : (
          <Panel title="Best sellers" icon="spark">
            <BestSellers rows={d.best} />
          </Panel>
        )}
        <Panel title="Quick actions" icon="spark">
          <QuickActions allowed={allowed} />
        </Panel>
      </div>

      {/* ── Sellers, areas, demand ────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {allowed("orders.view") && (
          <Panel title="Best sellers" icon="spark" action={allowed("catalogue.view") ? <ViewAll href="/catalogue" label="Products" /> : undefined}>
            <BestSellers rows={d.best} />
          </Panel>
        )}
        <Panel title="Revenue by area" icon="map" action={allowed("zones.view") ? <ViewAll href="/zones" label={`${d.zones} areas`} /> : undefined}>
          <Areas rows={d.sales.byZone} />
        </Panel>
        <KachiCard d={d} canReview={allowed("insights.view")} />
      </div>
    </div>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function TodayTile({ tone, chip, icon, label, value, note, href }: { tone: string; chip: string; icon: IconName; label: string; value: string; note: string; href?: string }) {
  const body = (
    <div className={cx("h-full rounded-2xl p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur transition-transform", tone, href && "group-hover:-translate-y-0.5")}>
      <div className="flex items-start gap-3">
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", chip)}>
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-carbon/55">{label}</p>
          <p className="mt-0.5 truncate text-[22px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
          <p className="mt-0.5 truncate text-[11px] text-carbon/45">{note}</p>
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-carbon">
      {body}
    </Link>
  ) : (
    body
  );
}

function Kpi({
  id,
  icon,
  chip,
  label,
  value,
  change,
  spark,
  stroke,
  fill,
  dark,
}: {
  id: string;
  icon: IconName;
  chip: string;
  label: string;
  value: string;
  change: number | null;
  spark: number[];
  stroke?: string;
  fill?: string;
  dark?: boolean;
}) {
  return (
    <section
      className={cx(
        "animate-[admin-rise_0.5s_ease-out_both] overflow-hidden rounded-[22px] p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.04)]",
        dark ? "bg-[#0b3b26] text-paper-white" : "bg-paper-white",
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cx("text-[13px] font-semibold", dark ? "text-paper-white/70" : "text-carbon/55")}>{label}</p>
        <span className={cx("grid h-9 w-9 place-items-center rounded-xl", dark ? "bg-paper-white/10 text-mint-pop" : cx(chip, "text-carbon"))}>
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
      <div className="mt-3 flex items-center gap-2">
        <Delta value={change} className={dark ? "bg-paper-white/12! text-mint-pop!" : undefined} />
        <span className={cx("text-[11px]", dark ? "text-paper-white/50" : "text-carbon/40")}>vs previous period</span>
      </div>
      <Sparkline id={id} values={spark} className="mt-4 -mb-1 h-12 w-full" stroke={dark ? "#55db9c" : stroke} fill={dark ? "#55db9c" : fill} />
    </section>
  );
}

function MiniStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-[#f6f7f4] p-3.5">
      <p className="text-[12px] text-carbon/50">{label}</p>
      <p className="mt-0.5 text-[20px] leading-tight font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-carbon/45">{note}</p>
    </div>
  );
}

const PIPE_COLOR: Record<string, string> = {
  RECEIVED: "#ffd731",
  CONFIRMED: "#b9a8ff",
  PICKING: "#4da2ff",
  PACKED: "#5c4ade",
  OUT_FOR_DELIVERY: "#55db9c",
};

function Pipeline({ d }: { d: Overview }) {
  const open = d.pipeline.reduce((s, p) => s + p.count, 0);
  return (
    <div>
      <div className="flex justify-center">
        <Donut
          segments={d.pipeline.map((p) => ({ label: STATUS_LABEL[p.status], value: p.count, color: PIPE_COLOR[p.status] }))}
          center={count(open)}
          sub="open orders"
          size={184}
        />
      </div>
      <ul className="mt-6 space-y-2.5">
        {d.pipeline.map((p) => (
          <li key={p.status} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIPE_COLOR[p.status] }} />
            <span className="flex-1 text-carbon/70">{STATUS_LABEL[p.status]}</span>
            <span className="font-semibold tabular-nums">{p.count}</span>
          </li>
        ))}
      </ul>
      {d.failed > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-ember/8 px-3 py-2 text-[12px] font-semibold text-[#9a2c00]">
          <Icon name="alert" className="h-4 w-4" />
          {d.failed} failed deliver{d.failed === 1 ? "y needs" : "ies need"} a retry
        </p>
      )}
    </div>
  );
}

function DeliveryCalendar({ cal }: { cal: Overview["calendar"] }) {
  const first = new Date(Date.UTC(cal.year, cal.month, 1));
  const daysIn = new Date(Date.UTC(cal.year, cal.month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const total = Object.values(cal.deliveries).reduce((s, n) => s + n, 0);
  const upcoming = Object.entries(cal.deliveries)
    .map(([day, n]) => ({ day: Number(day), n }))
    .filter((x) => x.day >= cal.today)
    .sort((a, b) => a.day - b.day)
    .slice(0, 2);
  return (
    <section className="animate-[admin-rise_0.5s_ease-out_both] rounded-[26px] bg-paper-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f1f3ef] text-carbon/70">
            <Icon name="calendar" className="h-4 w-4" />
          </span>
          Deliveries
        </h2>
        <span className="text-[13px] font-semibold text-carbon/55">{month}</span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-carbon/35">
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
          <span key={i} className="pb-2">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          const n = day ? (cal.deliveries[day] ?? 0) : 0;
          const isToday = day === cal.today;
          return (
            <div key={i} className="grid h-9 place-items-center">
              {day && (
                <span
                  className={cx(
                    "relative grid h-8 w-8 place-items-center rounded-full text-[12px] tabular-nums",
                    isToday ? "bg-[#0b3b26] font-semibold text-paper-white" : day < cal.today ? "text-carbon/30" : "text-carbon/75",
                    n > 0 && !isToday && "bg-mint-pop/25 font-semibold text-[#0b5a35]",
                  )}
                  title={n ? `${n} deliver${n === 1 ? "y" : "ies"}` : undefined}
                >
                  {day}
                  {n > 0 && <span className={cx("absolute -bottom-0.5 h-1 w-1 rounded-full", isToday ? "bg-mint-pop" : "bg-[#0f7a48]")} />}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2 border-t border-black/5 pt-4">
        {upcoming.length === 0 ? (
          <p className="text-[12px] text-carbon/50">No deliveries booked for the rest of the month.</p>
        ) : (
          upcoming.map((u) => (
            <div key={u.day} className="flex items-center gap-3 rounded-xl bg-[#f6f7f4] px-3 py-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-paper-white text-[13px] font-semibold tabular-nums shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">{u.day}</span>
              <div className="flex-1 text-[12px]">
                <p className="font-semibold">{u.day === cal.today ? "Today" : new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(cal.year, cal.month, u.day)))}</p>
                <p className="text-carbon/50">
                  {u.n} deliver{u.n === 1 ? "y" : "ies"} booked
                </p>
              </div>
            </div>
          ))
        )}
        <p className="pt-1 text-[11px] text-carbon/40">{total} deliveries booked this month.</p>
      </div>
    </section>
  );
}

function RecentOrders({ rows }: { rows: Overview["recent"] }) {
  if (rows.length === 0) return <p className="text-[13px] text-carbon/50">No orders yet.</p>;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead>
          <tr className="text-[11px] tracking-wide text-carbon/40 uppercase">
            <th className="px-2 pb-3 font-semibold">Order</th>
            <th className="px-2 pb-3 font-semibold">Placed</th>
            <th className="px-2 pb-3 font-semibold">Area</th>
            <th className="px-2 pb-3 font-semibold">Items</th>
            <th className="px-2 pb-3 text-right font-semibold">Total</th>
            <th className="px-2 pb-3 text-right font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="group border-t border-black/5">
              <td className="px-2 py-3">
                <Link href={`/orders/${o.id}`} className="flex items-center gap-2.5 font-semibold group-hover:underline">
                  <span className={cx("grid h-8 w-8 place-items-center rounded-lg", o.type === "ONE_OFF" ? "bg-sky-wash text-[#1d4f86]" : "bg-mint-pop/25 text-[#0b5a35]")}>
                    <Icon name={o.type === "ONE_OFF" ? "cart" : "box"} className="h-4 w-4" />
                  </span>
                  {orderRef(o.id)}
                </Link>
              </td>
              <td className="px-2 py-3 text-carbon/60">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(o.createdAt)}</td>
              <td className="px-2 py-3 text-carbon/60">{o.zone}</td>
              <td className="px-2 py-3 text-carbon/60 tabular-nums">{o.items}</td>
              <td className="px-2 py-3 text-right font-semibold tabular-nums">{naira(o.total)}</td>
              <td className="px-2 py-3 text-right">
                <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ACTIONS: { href: string; label: string; icon: IconName; tone: string; permission: Permission }[] = [
  { href: "/fulfilment", label: "Pack orders", icon: "box", tone: "bg-sunburst/35 text-[#6b5000]", permission: "fulfilment.view" },
  { href: "/delivery", label: "Plan a run", icon: "truck", tone: "bg-sky-wash text-[#1d4f86]", permission: "delivery.view" },
  { href: "/inventory/receive", label: "Receive stock", icon: "stock", tone: "bg-mint-pop/30 text-[#0b5a35]", permission: "inventory.receive" },
  { href: "/catalogue/new", label: "New product", icon: "tag", tone: "bg-lavender/70 text-[#3b2a9e]", permission: "catalogue.edit" },
  { href: "/recipes/new", label: "New recipe", icon: "book", tone: "bg-[#ffe1d3] text-[#9a2c00]", permission: "recipes.edit" },
  { href: "/insights/exports", label: "Export a report", icon: "chart", tone: "bg-[#eef0ea] text-carbon/75", permission: "reports.export" },
];

function QuickActions({ allowed }: { allowed: (p: Permission) => boolean }) {
  const list = ACTIONS.filter((a) => allowed(a.permission));
  if (list.length === 0) return <p className="text-[13px] text-carbon/50">Nothing to act on with your role.</p>;
  return (
    <div className="grid grid-cols-3 gap-3">
      {list.map((a) => (
        <Link key={a.href} href={a.href} className="group flex flex-col items-center gap-2 rounded-2xl bg-[#f6f7f4] px-2 py-4 text-center transition-colors hover:bg-[#eef0ea]">
          <span className={cx("grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:-translate-y-0.5", a.tone)}>
            <Icon name={a.icon} className="h-5 w-5" />
          </span>
          <span className="text-[12px] leading-tight font-semibold">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

function BestSellers({ rows }: { rows: Overview["best"] }) {
  if (rows.length === 0) return <p className="text-[13px] text-carbon/50">No paid orders in this period.</p>;
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.name} className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6f3e4] text-[20px]" aria-hidden>
            {r.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate font-semibold">
                <span className="mr-1.5 text-carbon/35 tabular-nums">{i + 1}</span>
                {r.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{compactNaira(r.revenue)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef0ea]">
              <div className="h-full origin-left animate-[admin-grow-x_0.8s_ease-out_both] rounded-full bg-mint-pop" style={{ width: `${Math.max(4, (r.revenue / max) * 100)}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const AREA_COLORS = ["#5c4ade", "#4da2ff", "#0f7a48", "#fb4903", "#b07a00"];

function Areas({ rows }: { rows: { label: string; orders: number; revenue: number }[] }) {
  if (rows.length === 0) return <p className="text-[13px] text-carbon/50">No paid orders in this period.</p>;
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  return (
    <ul className="space-y-4">
      {rows.slice(0, 4).map((r, i) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }} />
              {r.label}
            </span>
            <span className="tabular-nums">
              <span className="font-semibold">{total ? Math.round((r.revenue / total) * 100) : 0}%</span>
              <span className="ml-2 text-carbon/45">{compactNaira(r.revenue)}</span>
            </span>
          </div>
          <TickBar value={total ? r.revenue / total : 0} color={AREA_COLORS[i % AREA_COLORS.length]} />
        </li>
      ))}
    </ul>
  );
}

function KachiCard({ d, canReview }: { d: Overview; canReview: boolean }) {
  const k = d.demand.kachi;
  return (
    <section className="relative flex animate-[admin-rise_0.5s_ease-out_both] flex-col overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_100%_0%,#1f6b47_0%,#0b3b26_55%,#082b1c_100%)] p-6 text-paper-white lg:col-span-2 xl:col-span-1">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-mint-pop/20 blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint-pop text-carbon">
          <Icon name="leaf" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">Kachi</h2>
          <p className="text-[12px] text-paper-white/55">What customers ask for, last {d.days} days</p>
        </div>
      </div>
      <div className="relative mt-5 grid grid-cols-3 gap-2">
        {[
          { label: "Chats", value: k.threads },
          { label: "Messages", value: k.messages },
          { label: "People", value: k.users },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-paper-white/8 px-3 py-2.5">
            <p className="text-[20px] leading-tight font-semibold tabular-nums">{count(s.value)}</p>
            <p className="text-[11px] text-paper-white/55">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-5 flex-1 space-y-2">
        <p className="text-[11px] font-semibold tracking-wide text-paper-white/45 uppercase">Asked for, not stocked</p>
        {d.demand.unstocked.length === 0 ? (
          <p className="text-[13px] text-paper-white/60">No requests for things we don&apos;t sell.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {d.demand.unstocked.slice(0, 6).map((u) => (
              <span key={u.term} className="rounded-full bg-paper-white/10 px-2.5 py-1 text-[12px]">
                {u.term} <span className="text-mint-pop tabular-nums">{u.count}</span>
              </span>
            ))}
          </div>
        )}
        <p className="pt-2 text-[12px] text-paper-white/55">
          {count(d.demand.waitlistRecent)} new waitlist sign-up{d.demand.waitlistRecent === 1 ? "" : "s"} · {d.recipes.published} recipes live, {d.recipes.draft} in draft
        </p>
      </div>
      {canReview && (
        <Link href="/insights/demand" className="relative mt-5 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-paper-white text-[13px] font-semibold text-carbon hover:bg-mint-pop">
          See demand
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}

/** Soft produce shapes behind the greeting: pure decoration. */
function HeroArt() {
  return (
    <svg viewBox="0 0 400 300" className="pointer-events-none absolute -right-10 -bottom-16 hidden h-[340px] w-[440px] opacity-90 md:block" aria-hidden>
      <circle cx="300" cy="120" r="88" fill="#55db9c" opacity="0.35" />
      <circle cx="210" cy="190" r="56" fill="#ffd731" opacity="0.45" />
      <circle cx="350" cy="230" r="44" fill="#fb4903" opacity="0.18" />
      <circle cx="260" cy="60" r="22" fill="#4da2ff" opacity="0.3" />
      <path d="M300 60c-6 22-4 40 8 56M300 60c20 2 32 12 36 28-18 2-30-6-36-28Z" stroke="#0b5a35" strokeWidth="3" fill="#55db9c" strokeLinecap="round" opacity="0.7" />
      <circle cx="208" cy="188" r="26" fill="none" stroke="#b07a00" strokeWidth="2.5" opacity="0.35" />
    </svg>
  );
}
