"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { haptic } from "@/lib/haptics";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/components/cart-provider";
import { DELIVERY_WINDOW, cutoffLabel, dayName, longDate, shortDate, timeLeft } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";
import type { CycleWeek, CycleWeekState } from "@/lib/basket-rules";
import { removeDelivery, renameDelivery, setDeliveryDay, setRepeating, skipDate, startOneOff, type Result } from "./actions";
import { NewDeliverySheet, type DayOption } from "./new-delivery-sheet";

export type AreaState = { state: "ok" } | { state: "none" } | { state: "unserved"; name: string };

/**
 * Where the basket stands (lib/basket-rules.ts): a member's basket that comes
 * every week, one they've paused, a free account's trial basket, or a trial
 * that's been used (the produce stays, confirming needs a membership).
 */
export type BasketStatus = "running" | "paused" | "trial" | "trial-used" | "oneoff";

type Sheet = null | "menu" | "day" | "skip" | "rename" | "remove" | "new";

const WEEK_LABEL: Record<CycleWeekState, string> = {
  delivered: "Delivered",
  "on-the-way": "On the way",
  confirmed: "Confirmed",
  skipped: "Skipped",
  missed: "Missed",
  "to-confirm": "Confirm",
  upcoming: "Coming",
  before: "—",
};

/** Ticks every half minute, for the "confirm by" countdown. */
function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(t);
  }, [every]);
  return now;
}

/**
 * The top of Home: the basket's name and where it stands, its next delivery
 * and until when it can be confirmed or changed, its 4-week cycle, and
 * everything about the basket itself (its day, skipping a week, pausing,
 * its name). Changing the day never starts a checkout; skipping always asks
 * first and can be undone.
 */
export function DeliveryCard(props: {
  title: string;
  status: BasketStatus;
  cycle: { weekNumber: number; weeks: CycleWeek[] } | null;
  deliveryId: string;
  name: string | null;
  day: DeliveryDay;
  dateIso: string | null;
  cutoffIso: string | null;
  skippedDateIso: string | null;
  areaName: string | null;
  area: AreaState;
  isStanding: boolean;
  dayOptions: DayOption[];
  canRemove: boolean;
  canAddMore: boolean;
  member: boolean;
  /** An order from this basket is confirmed or on its way. */
  hasLiveOrder: boolean;
}) {
  const { deliveryId, dateIso, cutoffIso, skippedDateIso, area, status } = props;
  const router = useRouter();
  const cart = useCart();
  const now = useNow();
  const reduced = useReducedMotion();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, start] = useTransition();
  const [name, setName] = useState(props.name ?? "");
  const refreshed = useRef(false);

  const cutoff = cutoffIso ? new Date(cutoffIso).getTime() : null;
  const left = cutoff ? cutoff - now : null;

  // A basket just made in the New basket sheet: say so once it's on screen.
  useEffect(() => {
    let created: string | null = null;
    try {
      created = sessionStorage.getItem("basket.created");
      sessionStorage.removeItem("basket.created");
    } catch {
      /* nothing to announce */
    }
    if (created) {
      haptic("success");
      cart.announce(`${created} is ready. Add what it needs.`);
    }
    // Once, when the card first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The week closed while the page was open: move on to the next date.
  useEffect(() => {
    if (left !== null && left <= 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [left, router]);

  /**
   * Do something to the basket. Success is felt and said; anything that can be
   * taken back offers Undo in the same message.
   */
  const run = (action: () => Promise<Result>, ok?: string, closeFirst = false, undo?: { action: () => Promise<Result>; ok: string }) =>
    start(async () => {
      if (closeFirst) setSheet(null);
      const r = await action();
      if (!r.ok) {
        cart.announce(r.error, "error");
        return;
      }
      setSheet(null);
      haptic("success");
      if (ok) cart.announce(ok, "ok", undo ? { label: "Undo", run: () => run(undo.action, undo.ok) } : undefined);
    });

  const statusLine =
    status === "oneoff" ? "One-time order" : status === "running" ? `Every ${dayName(props.day)}` : status === "paused" ? "Paused" : status === "trial" ? "Trial basket" : props.hasLiveOrder ? "Trial confirmed" : "Trial used";
  const urgent = left !== null && left < 6 * 3_600_000;
  const canChangeDay = props.dayOptions.length > 1;
  const items = cart.items.filter((l) => !l.soldOut);
  const faces = items.slice(0, 3);
  const sideTab = props.member && status !== "oneoff";

  // The one thing to do next, as the card's big pill.
  const action: { label: string; href: string; icon: IconName; done?: boolean } =
    status === "trial-used"
      ? props.hasLiveOrder
        ? { label: "Confirmed", href: "/orders", icon: "checkPlain", done: true }
        : { label: "See membership", href: "/subscribe?reason=free-basket-used", icon: "spark" }
      : area.state !== "ok"
        ? { label: "Add your address", href: "/account/addresses?next=/basket", icon: "pin" }
        : items.length === 0
          ? { label: "Add produce", href: "/shop", icon: "plus" }
          : { label: "Confirm basket", href: `/checkout?b=${deliveryId}`, icon: "checkPlain" };

  // The card builds in order: the card, its words, the pill growing out of
  // its icon, the faces popping in. Nothing moves with reduced motion.
  const enter = (delay: number) => (reduced ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { ...spring.smooth, delay } });
  const pop = (delay: number) => (reduced ? {} : { initial: { opacity: 0, scale: 0 }, animate: { opacity: 1, scale: 1 }, transition: { ...spring.juicy, delay } });

  return (
    <section data-home-hero>
      <div className="grid gap-2" style={{ gridTemplateColumns: sideTab ? "minmax(0,1fr) auto" : "minmax(0,1fr)" }}>
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.smooth}
          className="relative overflow-hidden rounded-[28px] bg-mint-pop p-5 text-carbon sm:p-6"
        >
          <Curves />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <motion.div {...enter(0.08)} className="min-w-0">
                <h1 className="truncate text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">{props.title}</h1>
                {area.state === "ok" && dateIso ? (
                  <button
                    type="button"
                    disabled={!canChangeDay}
                    onClick={() => {
                      haptic("selection");
                      setSheet("day");
                    }}
                    aria-label={canChangeDay ? `Next delivery ${longDate(dateIso)}. Change day` : undefined}
                    className="mt-1 flex max-w-full items-start gap-1.5 text-left text-[14px] leading-snug text-carbon/75 enabled:active:opacity-70"
                  >
                    <Icon name="clock" size={15} className="mt-0.5 shrink-0" />
                    <span>
                      Next delivery: {shortDate(dateIso)}, {DELIVERY_WINDOW}
                      {canChangeDay && <Icon name="caretDown" size={12} weight="bold" className="ml-1 inline-block align-middle" />}
                    </span>
                  </button>
                ) : (
                  <p className="mt-1 truncate text-[14px] text-carbon/75">
                    {statusLine}
                    {props.areaName ? ` · ${props.areaName}` : ""}
                  </p>
                )}
              </motion.div>
              <button
                type="button"
                onClick={() => {
                  haptic("selection");
                  setSheet("menu");
                }}
                aria-label={`More for ${props.title}`}
                className="tap-target flex size-10 shrink-0 items-center justify-center rounded-full bg-carbon/10 transition-transform active:scale-95"
              >
                <Icon name="more" size={20} weight="bold" />
              </button>
            </div>

            {(status === "paused" || skippedDateIso) && status !== "trial-used" && (
              <motion.div {...enter(0.15)} className="mt-4 flex items-center gap-3 rounded-full bg-paper-white/70 py-1.5 pr-1.5 pl-4 text-[14px]">
                <Icon name={status === "paused" ? "recurring" : "calendar"} size={16} className="shrink-0 text-carbon/60" />
                <p className="min-w-0 flex-1 truncate">{status === "paused" ? "Paused. No reminders, no repeats." : <>Skipping {shortDate(skippedDateIso!)}</>}</p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    status === "paused"
                      ? run(() => setRepeating(deliveryId, true), `Every ${dayName(props.day)} again`)
                      : run(() => skipDate(deliveryId, skippedDateIso!, false), `${shortDate(skippedDateIso!)} is back on`)
                  }
                  className="shrink-0 rounded-full bg-carbon px-3.5 py-1.5 text-[13px] font-semibold text-paper-white transition-transform active:scale-95"
                >
                  {status === "paused" ? "Resume" : "Undo"}
                </button>
              </motion.div>
            )}

            {status === "trial-used" && !props.hasLiveOrder && (
              <motion.p {...enter(0.15)} className="mt-3 text-[14px] leading-snug text-carbon/80">
                Your trial is used and your produce is saved. Members get it every week, at member prices.
              </motion.p>
            )}
            {area.state === "unserved" && (
              <motion.p {...enter(0.15)} className="mt-3 text-[14px] leading-snug text-carbon/80">
                We don&apos;t deliver to {area.name} yet. We&apos;ll tell you when we reach you; you can still fill this basket.
              </motion.p>
            )}
            {area.state === "none" && (
              <motion.p {...enter(0.15)} className="mt-3 text-[14px] leading-snug text-carbon/80">
                Add your address to see the days we come to you.
              </motion.p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center">
                {faces.length > 0 ? (
                  <>
                    <div className="flex -space-x-2.5">
                      {faces.map((l, i) => (
                        <motion.span key={l.productId} {...pop(0.4 + i * 0.07)} className="block">
                          <ProductImage publicId={l.cloudinaryPublicId} alt="" emoji={l.imageEmoji} sizes="40px" rounded="rounded-full" flavour="bg-paper-white" emojiClassName="text-lg" className="h-10 w-10 ring-2 ring-mint-pop" />
                        </motion.span>
                      ))}
                    </div>
                    <motion.span {...enter(0.55)} className="ml-2.5 shrink-0 rounded-full bg-carbon/10 px-2.5 py-1 text-[13px] font-semibold tabular-nums">
                      {items.length === 1 ? "1 item" : `${items.length} items`}
                    </motion.span>
                  </>
                ) : (
                  <motion.span {...enter(0.4)} className="text-[14px] text-carbon/75">
                    Nothing in it yet
                  </motion.span>
                )}
              </div>
              {/* The clock only becomes a badge when it's close; otherwise it's in the line under the pill. */}
              {area.state === "ok" && left !== null && left > 0 && urgent && status !== "trial-used" && (
                <motion.span {...enter(0.5)} suppressHydrationWarning className="shrink-0 rounded-full bg-ember px-2.5 py-1 text-[12px] font-semibold text-paper-white tabular-nums">
                  {timeLeft(left)}
                </motion.span>
              )}
            </div>

            <motion.div initial={reduced ? false : { opacity: 0, scaleX: 0.18 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ ...spring.smooth, delay: 0.3 }} style={{ originX: 0 }} className="mt-4">
              <Link
                href={action.href}
                onClick={() => haptic("light")}
                className={`flex h-14 items-center gap-3 rounded-full p-1.5 pr-4 transition-transform active:scale-[0.98] ${action.done ? "bg-carbon/10" : "bg-paper-white shadow-[0_10px_24px_-14px_rgb(0_0_0/0.45)]"}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-carbon text-paper-white">
                  <Icon name={action.icon} size={18} weight="bold" />
                </span>
                <motion.span {...enter(0.45)} className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <b className="truncate text-[16px] font-semibold">{action.label}</b>
                  {!action.done && <Icon name="caretRight" size={16} weight="bold" className="shrink-0 text-carbon/50" />}
                </motion.span>
              </Link>
            </motion.div>
            {area.state === "ok" && cutoffIso && status !== "trial-used" && (
              <motion.p {...enter(0.5)} suppressHydrationWarning className="mt-2.5 px-1 text-[12px] leading-snug text-carbon/70">
                {left !== null && left > 0 && !urgent ? `${timeLeft(left)} · ` : ""}Confirm by {cutoffLabel(cutoffIso)}. Pay when it arrives.
              </motion.p>
            )}
          </div>
        </motion.div>

        {sideTab && (
          <motion.button
            type="button"
            {...enter(0.2)}
            onClick={() => {
              haptic("selection");
              if (props.canAddMore) setSheet("new");
              else router.push("/subscribe?reason=basket-limit");
            }}
            className="flex w-13 flex-col items-center justify-center gap-3 rounded-[24px] bg-mint-pop/40 py-5 text-carbon transition-colors active:bg-mint-pop/60"
            aria-label="New basket"
          >
            <Icon name="plus" size={16} weight="bold" />
            <span className="text-[13px] font-semibold [writing-mode:vertical-rl]">New basket</span>
          </motion.button>
        )}
      </div>

      {props.cycle && area.state === "ok" && status !== "trial-used" && (
        <motion.div {...enter(0.25)} className="mt-2 rounded-[22px] bg-surface ring-1 ring-hairline">
          <CycleBars weekNumber={props.cycle.weekNumber} weeks={props.cycle.weeks} />
        </motion.div>
      )}

      {status === "oneoff" && area.state === "ok" && <p className="mt-2 px-1 text-[13px] text-muted">Comes once, then it&apos;s cleared. Your baskets aren&apos;t touched.</p>}

      {status === "trial" && area.state === "ok" && (
        <p className="mt-2 px-1 text-[13px] text-muted">
          Your trial basket comes once.{" "}
          <Link href="/subscribe" className="font-semibold text-carbon underline underline-offset-2">
            Every week with membership
          </Link>
        </p>
      )}

      {/* ⋯ for this basket */}
      <BottomSheet open={sheet === "menu"} onClose={() => setSheet(null)} title={props.title}>
        <div className="grid gap-1">
          {status === "running" && dateIso && area.state === "ok" && (
            <MenuRow icon="calendar" title={`Skip ${shortDate(dateIso)}`} sub="Nothing comes that day. Your produce stays for the week after." onClick={() => setSheet("skip")} />
          )}
          {props.member &&
            status !== "oneoff" &&
            (props.isStanding ? (
              <MenuRow icon="recurring" title="Pause this basket" sub="It stops coming and we stop reminding you. Your produce stays here." onClick={() => run(() => setRepeating(deliveryId, false), "Paused", true, { action: () => setRepeating(deliveryId, true), ok: `Every ${dayName(props.day)} again` })} />
            ) : (
              <MenuRow icon="recurring" title="Resume every week" sub={`Every ${dayName(props.day)}, with a reminder before each one`} onClick={() => run(() => setRepeating(deliveryId, true), `Every ${dayName(props.day)} again`, true)} />
            ))}
          {status !== "oneoff" && (
            <MenuRow icon="edit" title="Rename" sub={props.name ? `Called "${props.name}"` : "Give it a name, like “For Mum”"} onClick={() => setSheet("rename")} />
          )}
          {props.member && status !== "oneoff" && (
            <MenuRow
              icon="box"
              title="Start a one-time order"
              sub="Something extra, delivered once. This basket isn't touched."
              onClick={() =>
                start(async () => {
                  const r = await startOneOff();
                  if (!r.ok) return cart.announce(r.error, "error");
                  setSheet(null);
                  haptic("success");
                  await cart.refresh();
                  router.refresh();
                  cart.announce("One-time order open. Add what you'd like from the shop.");
                })
              }
            />
          )}
          {status === "oneoff" ? null : props.member && props.canAddMore ? (
            <MenuRow icon="plus" title="New basket" sub="For someone else, like your mum, on its own day" onClick={() => setSheet("new")} />
          ) : (
            <MenuLink
              icon="plus"
              title="New basket"
              sub={props.member ? "Member Plus runs as many baskets as you need" : "Members run up to three, like one for Mum or the office"}
              href={props.member ? "/subscribe?reason=basket-limit" : "/subscribe?reason=free-basket-used"}
            />
          )}
          {props.canRemove && (
            <MenuRow
              icon="trash"
              title={status === "oneoff" ? "Discard this one-time order" : "Remove this basket"}
              sub={status === "oneoff" ? "Its produce goes with it. Your baskets aren't touched." : "Its produce goes with it"}
              onClick={() => setSheet("remove")}
            />
          )}
        </div>
      </BottomSheet>

      {/* Change day */}
      <BottomSheet open={sheet === "day"} onClose={() => setSheet(null)} title="Delivery day">
        <p className="text-sm text-muted">{props.areaName ? `We come to ${props.areaName} on these days.` : "Pick a day."} Your produce stays as it is.</p>
        <div className="mt-3 grid gap-2">
          {props.dayOptions.map((o) => {
            const on = o.day === props.day;
            return (
              <button
                key={o.day}
                type="button"
                disabled={pending}
                onClick={() => (on ? setSheet(null) : run(() => setDeliveryDay(deliveryId, o.day), `Moved to ${dayName(o.day)}s`))}
                aria-pressed={on}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${on ? "border-carbon bg-mint-pop/20" : "border-hairline bg-surface"}`}
              >
                <span>
                  <b className="block font-semibold">{dayName(o.day)}s</b>
                  <small className="block text-[13px] text-muted">
                    Next {shortDate(o.dateIso)} · confirm by {cutoffLabel(o.cutoffIso)}
                  </small>
                </span>
                {on && <Icon name="checkPlain" size={18} weight="bold" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Skip, asked first */}
      <BottomSheet open={sheet === "skip"} onClose={() => setSheet(null)} title={dateIso ? `Skip ${longDate(dateIso)}?` : "Skip"}>
        <p className="text-sm text-muted">Nothing comes that day and nothing is charged. Your produce stays ready for the week after, and you can undo this until it closes.</p>
        <div className="mt-5 grid gap-2">
          <Button size="lg" loading={pending} onClick={() => dateIso && run(() => skipDate(deliveryId, dateIso, true), `Skipped ${shortDate(dateIso)}`, false, { action: () => skipDate(deliveryId, dateIso, false), ok: `${shortDate(dateIso)} is back on` })}>
            Skip this week
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setSheet(null)}>
            Keep it
          </Button>
        </div>
      </BottomSheet>

      {/* Rename */}
      <BottomSheet open={sheet === "rename"} onClose={() => setSheet(null)} title="Name this basket">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renameDelivery(deliveryId, name), "Saved");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="My basket"
            aria-label="Basket name"
            autoComplete="off"
            className="h-12 w-full rounded-control border border-hairline bg-surface px-4 text-base outline-none focus:border-carbon"
          />
          <p className="mt-1.5 text-xs text-muted">Leave it empty to call it “My basket”.</p>
          <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
            Save
          </Button>
        </form>
      </BottomSheet>

      {/* Remove */}
      <BottomSheet open={sheet === "remove"} onClose={() => setSheet(null)} title="Remove this basket?">
        <p className="text-sm text-muted">Its produce and its day go with it. Deliveries you&apos;ve already confirmed aren&apos;t affected.</p>
        <div className="mt-5 grid gap-2">
          <Button size="lg" variant="danger" loading={pending} onClick={() => run(() => removeDelivery(deliveryId), "Basket removed")}>
            Remove it
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setSheet(null)}>
            Keep it
          </Button>
        </div>
      </BottomSheet>

      <NewDeliverySheet open={sheet === "new"} onClose={() => setSheet(null)} dayOptions={props.dayOptions} />
    </section>
  );
}

/** Each week's colour: the bar says it at a glance, the date under it is tinted to match. */
const WEEK_TONE: Record<CycleWeekState, { bar: string; date: string }> = {
  delivered: { bar: "bg-[#1f9d55]", date: "text-[#0f7a48]" },
  confirmed: { bar: "bg-mint-pop", date: "text-[#0f7a48]" },
  "on-the-way": { bar: "bg-electric-blue", date: "text-[#1f6fd1]" },
  "to-confirm": { bar: "bg-sunburst", date: "text-carbon font-semibold" },
  skipped: { bar: "bg-carbon/25", date: "text-muted line-through" },
  missed: { bar: "bg-ember", date: "text-ember" },
  upcoming: { bar: "bg-carbon/10", date: "text-muted" },
  before: { bar: "bg-carbon/[0.05]", date: "text-carbon/30" },
};

/** Thin arcs behind the hero, like the weave of a basket: decoration, never in the way. */
function Curves() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full text-carbon/10" viewBox="0 0 400 260" fill="none" preserveAspectRatio="xMidYMid slice">
      <path d="M-30 210c70-90 150 40 230-40s120-90 230-60" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40-20c40 70-30 110 20 190s110 60 150 120" stroke="currentColor" strokeWidth="1.5" />
      <path d="M250-10c60 50 30 120 110 150" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="330" cy="44" r="3" fill="currentColor" />
      <circle cx="62" cy="150" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** The four weeks of the membership cycle, as one quiet row under the hero. */
function CycleBars({ weekNumber, weeks }: { weekNumber: number; weeks: CycleWeek[] }) {
  const missed = weeks.filter((w) => w.state === "missed").length;
  const delivered = weeks.filter((w) => w.state === "delivered").length;
  const summary = missed ? `${missed} missed` : delivered ? `${delivered} delivered` : "On track";
  return (
    <div className="px-4 pt-3 pb-4">
      <p className="flex items-baseline justify-between text-[12px] text-muted">
        <span className="font-medium">Week {weekNumber} of 4</span>
        <span>{summary}</span>
      </p>
      <ol className="mt-2 grid grid-cols-4 gap-1.5">
        {weeks.map((w, i) => {
          const t = WEEK_TONE[w.state];
          const date = new Date(w.dateIso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
          const body = (
            <>
              <motion.span
                className={`block h-1.5 origin-left rounded-full ${t.bar}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ ...spring.smooth, delay: 0.08 + i * 0.07 }}
              />
              <span className={`mt-1.5 block text-[12px] tabular-nums ${t.date}`}>{date}</span>
            </>
          );
          const label = `${date}: ${WEEK_LABEL[w.state] === "—" ? "before this basket" : WEEK_LABEL[w.state].toLowerCase()}`;
          return (
            <li key={w.dateIso} aria-label={label}>
              {w.orderId ? (
                <Link href={`/orders/${w.orderId}`} className="block">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MenuRow({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-soft-mist">
      <RowBody icon={icon} title={title} sub={sub} />
    </button>
  );
}

function MenuLink({ icon, title, sub, href }: { icon: IconName; title: string; sub: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-soft-mist">
      <RowBody icon={icon} title={title} sub={sub} />
    </Link>
  );
}

function RowBody({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="block text-[13px] text-muted">{sub}</small>
      </span>
      <Icon name="caretRight" size={16} className="shrink-0 text-muted" />
    </>
  );
}
