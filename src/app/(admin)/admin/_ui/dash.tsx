import type { CSSProperties, ReactNode } from "react";
import { cx } from "./kit";

/*
 * Dashboard charts. Like charts.tsx they are server-rendered SVG and HTML with
 * no client script (the admin CSP allows none we don't sign): hover states are
 * pure CSS, entrances are CSS keyframes that reduced-motion turns off, and
 * every figure carries a text label for screen readers.
 */

export const compactNaira = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `₦${(n / 1_000_000).toLocaleString("en-NG", { maximumFractionDigits: 1 })}m`;
  if (a >= 10_000) return `₦${Math.round(n / 1000).toLocaleString("en-NG")}k`;
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
};

/** A round number at or above n, so axis ticks land on tidy values. */
function niceCeil(n: number) {
  if (n <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  const f = n / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** A smooth path through the points (Catmull-Rom as cubic Béziers), clamped to the box. */
function smooth(pts: [number, number][], top = 0, bottom = 100) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const clamp = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Up or down against the previous period. `null` means there was nothing before to compare with. */
export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null)
    return <span className={cx("inline-flex h-6 items-center rounded-full bg-sky-wash px-2 text-[11px] font-semibold text-[#1d4f86]", className)}>New</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const pct = `${Math.abs(value * 100).toLocaleString("en-NG", { maximumFractionDigits: Math.abs(value) < 0.1 ? 1 : 0 })}%`;
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[11px] font-semibold tabular-nums",
        up && "bg-mint-pop/30 text-[#0b5a35]",
        down && "bg-ember/12 text-[#9a2c00]",
        !up && !down && "bg-black/5 text-carbon/60",
        className,
      )}
    >
      <span aria-hidden>{up ? "↑" : down ? "↓" : "→"}</span>
      <span className="sr-only">{up ? "up" : down ? "down" : "level"}</span>
      {pct}
    </span>
  );
}

/** A small trend line with a soft fill. */
export function Sparkline({ id, values, stroke = "#0b5a35", fill = "#55db9c", className = "h-10 w-full" }: { id: string; values: number[]; stroke?: string; fill?: string; className?: string }) {
  const max = Math.max(...values, 0);
  const n = Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [(i / n) * 100, max ? 30 - (v / max) * 26 : 30] as [number, number]);
  const line = smooth(pts, 1, 31);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={fill} stopOpacity="0.45" />
          <stop offset="1" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        className="animate-[admin-draw_1.1s_ease-out_both]"
      />
    </svg>
  );
}

/**
 * The headline time series: a smooth area with a y-axis, a pinned bubble on
 * the best day and a hover read-out for every day.
 */
export function AreaChart({
  id,
  points,
  format,
  axisFormat = format,
  label,
  stroke = "#0f7a48",
  fill = "#55db9c",
}: {
  id: string;
  points: { key: string; label: string; value: number; note?: string }[];
  format: (n: number) => string;
  axisFormat?: (n: number) => string;
  label: string;
  stroke?: string;
  fill?: string;
}) {
  const max = niceCeil(Math.max(0, ...points.map((p) => p.value)));
  const n = Math.max(1, points.length - 1);
  const xy = points.map((p, i) => [(i / n) * 100, 100 - (p.value / max) * 92] as [number, number]);
  const line = smooth(xy, 0, 100);
  const peak = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
  const showPeak = points.length > 0 && points[peak].value > 0;
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const every = Math.max(1, Math.ceil(points.length / 7));
  const total = points.reduce((s, p) => s + p.value, 0);

  return (
    <figure role="img" aria-label={`${label}: ${format(total)} in total, best day ${showPeak ? `${points[peak].label} at ${format(points[peak].value)}` : "none yet"}`}>
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex h-60 flex-col justify-between pb-0 text-right text-[11px] text-carbon/40 tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {axisFormat(max * t)}
            </span>
          ))}
        </div>
        <div className="relative h-60">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-black/8" style={{ top: `${(1 - t) * 100}%` }} aria-hidden />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={fill} stopOpacity="0.5" />
                <stop offset="0.7" stopColor={fill} stopOpacity="0.08" />
                <stop offset="1" stopColor={fill} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${id})`} className="animate-[admin-rise_0.8s_ease-out_both]" />
            <path
              d={line}
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              strokeDasharray="1"
              className="animate-[admin-draw_1.4s_ease-out_both]"
            />
          </svg>

          {showPeak && (
            <div className="pointer-events-none absolute" style={{ left: `${xy[peak][0]}%`, top: `${xy[peak][1]}%` }} aria-hidden>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[#0b3b26] px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-paper-white shadow-lg">
                {format(points[peak].value)}
                <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#0b3b26]" />
              </div>
              <span className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper-white bg-[#0f7a48] shadow" />
            </div>
          )}

          {/* One invisible column per day; hovering it shows that day's read-out. */}
          <div className="absolute inset-0 flex" aria-hidden>
            {points.map((p, i) => (
              <div key={p.key} className="group relative h-full flex-1">
                <div className="absolute inset-y-0 left-1/2 hidden w-px bg-carbon/15 group-hover:block" />
                <span
                  className="absolute left-1/2 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-white bg-carbon group-hover:block"
                  style={{ top: `${xy[i][1]}%` }}
                />
                <div
                  className={cx(
                    "absolute top-2 z-10 hidden min-w-28 rounded-xl bg-paper-white px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.12),0_0_0_1px_rgb(0_0_0/0.05)] group-hover:block",
                    i > points.length / 2 ? "right-1/2 mr-2" : "left-1/2 ml-2",
                  )}
                >
                  <p className="text-carbon/50">{p.label}</p>
                  <p className="text-[14px] font-semibold tabular-nums">{format(p.value)}</p>
                  {p.note && <p className="text-carbon/50">{p.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div />
        <div className="mt-2 flex text-[11px] text-carbon/40" aria-hidden>
          {points.map((p, i) => (
            <span key={p.key} className="flex-1 text-center whitespace-nowrap">
              {i % every === 0 || i === points.length - 1 ? p.label : ""}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** A ring split into coloured arcs, with a figure in the middle. */
export function Donut({
  segments,
  center,
  sub,
  size = 176,
  thickness = 16,
}: {
  segments: { label: string; value: number; color: string }[];
  center: ReactNode;
  sub?: ReactNode;
  size?: number;
  thickness?: number;
}) {
  const r = 50 - thickness / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.filter((s) => s.value > 0);
  const gap = shown.length > 1 ? 2.2 : 0;
  let at = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eef0ea" strokeWidth={thickness} />
        {total > 0 &&
          shown.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0.01, len - gap);
            const el = (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap={shown.length > 1 ? "round" : "butt"}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-at - gap / 2}
                className="animate-[admin-rise_0.7s_ease-out_both]"
              >
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
            at += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{center}</div>
        {sub && <div className="mt-1 text-[11px] text-carbon/50">{sub}</div>}
      </div>
    </div>
  );
}

/** A half-ring of separate segments, filled up to `value` (0 to 1). */
export function Gauge({ value, center, sub, segments = 16 }: { value: number; center: ReactNode; sub?: ReactNode; segments?: number }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * segments);
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 200 112" className="w-full" aria-hidden>
        {Array.from({ length: segments }, (_, i) => {
          const a = Math.PI + ((i + 0.5) / segments) * Math.PI;
          const x = 100 + Math.cos(a) * 78;
          const y = 104 + Math.sin(a) * 78;
          const on = i < filled;
          const shade = on ? `hsl(${148 - (i / segments) * 8} ${62 - (i / Math.max(1, filled)) * 18}% ${46 + (i / Math.max(1, filled)) * 20}%)` : "#eef0ea";
          return (
            <rect
              key={i}
              x={x - 6}
              y={y - 15}
              width="12"
              height="30"
              rx="5"
              fill={shade}
              transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
              className="animate-[admin-rise_0.5s_ease-out_both]"
              style={{ animationDelay: `${i * 30}ms` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{center}</div>
        {sub && <div className="mt-1 text-[11px] text-carbon/50">{sub}</div>}
      </div>
    </div>
  );
}

/** Vertical bars with the top one highlighted and labelled, the rest hatched. */
export function HighlightBars({ values, labels, format, label }: { values: number[]; labels: string[]; format: (n: number) => string; label: string }) {
  const max = Math.max(1, ...values);
  const top = values.some((v) => v > 0) ? values.indexOf(Math.max(...values)) : -1;
  const hatch: CSSProperties = { backgroundImage: "repeating-linear-gradient(135deg, rgb(0 0 0 / 0.05) 0 2px, transparent 2px 7px)" };
  return (
    <figure role="img" aria-label={`${label}: ${labels.map((l, i) => `${l} ${format(values[i])}`).join(", ")}`}>
      <div className="flex h-44 items-end gap-2.5" aria-hidden>
        {values.map((v, i) => (
          <div key={labels[i]} className="group relative flex h-full flex-1 items-end">
            {i === top && (
              <div className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-carbon px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-paper-white" style={{ bottom: `calc(${(v / max) * 100}% + 8px)` }}>
                {format(v)}
              </div>
            )}
            <div
              className={cx(
                "w-full origin-bottom animate-[admin-grow_0.7s_cubic-bezier(.2,.8,.2,1)_both] rounded-t-[10px] rounded-b-md",
                i === top ? "bg-mint-pop" : "bg-[#eef0ea] group-hover:bg-[#e2e6dc]",
              )}
              style={{ height: `${Math.max(6, (v / max) * 100)}%`, animationDelay: `${i * 50}ms`, ...(i === top ? {} : hatch) }}
              title={`${labels[i]}: ${format(v)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2.5 text-center text-[11px] text-carbon/45" aria-hidden>
        {labels.map((l, i) => (
          <span key={l} className={cx("flex-1", i === top && "font-semibold text-carbon")}>
            {l}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** One bar split into parts, with a legend underneath. */
export function SegmentBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-3.5 gap-1 overflow-hidden" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {total === 0 ? (
          <div className="flex-1 rounded-full bg-[#eef0ea]" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                className="origin-left animate-[admin-grow-x_0.8s_cubic-bezier(.2,.8,.2,1)_both] rounded-full"
                style={{ flexGrow: s.value, backgroundColor: s.color }}
                title={`${s.label}: ${s.value}`}
              />
            ))
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {segments.map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1.5 text-[12px] text-carbon/55">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
              {total > 0 && <span className="text-carbon/35">({Math.round((s.value / total) * 100)}%)</span>}
            </dt>
            <dd className="text-[22px] leading-tight font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A row of thin ticks, the first `value` share of them coloured. */
export function TickBar({ value, color, ticks = 26 }: { value: number; color: string; ticks?: number }) {
  const on = Math.round(Math.min(1, Math.max(0, value)) * ticks);
  return (
    <div className="flex h-7 gap-[3px]" aria-hidden>
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className="flex-1 rounded-full" style={{ backgroundColor: i < on ? color : "#eef0ea", opacity: i < on ? 0.55 + (0.45 * (i + 1)) / Math.max(1, on) : 1 }} />
      ))}
    </div>
  );
}

/** A small progress ring. */
export function Ring({ value, size = 56, color = "#0f7a48", children }: { value: number; size?: number; color?: string; children?: ReactNode }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 50 50" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="25" cy="25" r={r} fill="none" stroke="rgb(0 0 0 / 0.07)" strokeWidth="5" />
        <circle cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} className="animate-[admin-rise_0.7s_ease-out_both]" />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-[12px] font-semibold tabular-nums">{children}</div>
    </div>
  );
}
