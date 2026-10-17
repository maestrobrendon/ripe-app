import Link from "next/link";
import { cx } from "./kit";

/** Chips for the delivery days that have work, plus a date box for any other day. */
export function DayPicker({ base, days, current }: { base: string; days: { ymd: string; count: number }[]; current: string }) {
  const label = (s: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s}T00:00:00Z`));
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
      {days.map((d) => (
        <Link
          key={d.ymd}
          href={`${base}?day=${d.ymd}`}
          aria-current={d.ymd === current ? "date" : undefined}
          className={cx("flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold", d.ymd === current ? "bg-carbon text-paper-white" : "bg-paper-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] hover:bg-soft-mist/60")}
        >
          {label(d.ymd)}
          <span className={cx("tabular-nums", d.ymd === current ? "text-paper-white/60" : "text-carbon/40")}>{d.count}</span>
        </Link>
      ))}
      <form action={base} className="flex items-center gap-2">
        <input type="date" name="day" defaultValue={current} aria-label="Another day" className="h-9 rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]" />
        <button className="h-9 rounded-lg px-3 text-[13px] font-semibold hover:bg-soft-mist/70">Go</button>
      </form>
    </div>
  );
}
