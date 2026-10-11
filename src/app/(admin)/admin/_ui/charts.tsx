import { cx } from "./kit";

/*
 * Small, dependency-free charts for the admin: server-rendered SVG and CSS,
 * so they need no scripts and fit the strict admin CSP. Every chart carries
 * a text summary for screen readers.
 */

/** Daily columns, e.g. orders per day. The last bar (today) is highlighted. */
export function ColumnChart({
  points,
  format = (n) => n.toLocaleString("en-NG"),
  label,
  height = 140,
}: {
  points: { key: string; value: number; title: string }[];
  format?: (n: number) => string;
  label: string;
  height?: number;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const w = 100 / Math.max(1, points.length);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={`${label}: ${format(total)} in total, highest ${format(max)}`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2="100" y1={height * f} y2={height * f} stroke="rgb(0 0 0 / 0.06)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {points.map((p, i) => {
          const h = (p.value / max) * (height - 4);
          return (
            <rect
              key={p.key}
              x={i * w + w * 0.15}
              y={height - h}
              width={w * 0.7}
              height={Math.max(h, p.value ? 1 : 0)}
              rx="0.6"
              fill={i === points.length - 1 ? "#151515" : "#9bf0c4"}
            >
              <title>{`${p.title}: ${format(p.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-carbon/45">
        <span>{points[0]?.title}</span>
        <span>{points[points.length - 1]?.title}</span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bars for a ranked list. */
export function BarList({ rows, format = (n) => n.toLocaleString("en-NG"), empty = "Nothing yet." }: { rows: { label: string; value: number; note?: string }[]; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-[13px] text-carbon/50">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-[13px]">
          <div className="flex justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {format(r.value)}
              {r.note && <span className="ml-1 font-normal text-carbon/50">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-soft-mist" aria-hidden>
            <div className={cx("h-full rounded-full bg-carbon")} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-paper-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <p className="text-[12px] font-semibold text-carbon/55">{label}</p>
      <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-carbon/45">{note}</p>}
    </div>
  );
}
