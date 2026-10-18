"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, LinkButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { DELIVERY_WINDOW, cutoffLabel, dayName, longDate, shortDate, timeLeft } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { removeDelivery, renameDelivery, setDeliveryDay, setWeeklyReminder, skipDate, type Result } from "./actions";
import { NewDeliverySheet, type DayOption } from "./new-delivery-sheet";

export type AreaState = { state: "ok" } | { state: "none" } | { state: "unserved"; name: string };

type Sheet = null | "menu" | "day" | "skip" | "rename" | "remove" | "new";

/** Ticks every half minute, for the "change until" countdown. */
function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(t);
  }, [every]);
  return now;
}

/**
 * The top of Home: which order this is, when it comes, until when it can
 * change, and everything about the delivery itself (its day, skipping a
 * week, the weekly reminder, its name). Changing the day never starts a
 * checkout; skipping always asks first and can be undone.
 */
export function DeliveryCard(props: {
  title: string;
  eyebrow: string | null;
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
}) {
  const { deliveryId, dateIso, cutoffIso, skippedDateIso, area } = props;
  const router = useRouter();
  const cart = useCart();
  const now = useNow();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, start] = useTransition();
  const [name, setName] = useState(props.name ?? "");
  const refreshed = useRef(false);

  const cutoff = cutoffIso ? new Date(cutoffIso).getTime() : null;
  const left = cutoff ? cutoff - now : null;

  // The order closed while the page was open: move on to the next date.
  useEffect(() => {
    if (left !== null && left <= 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [left, router]);

  const run = (action: () => Promise<Result>, ok?: string) =>
    start(async () => {
      const r = await action();
      if (!r.ok) {
        cart.announce(r.error, "error");
        return;
      }
      setSheet(null);
      if (ok) cart.announce(ok);
    });

  return (
    <section>
      {props.eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{props.eyebrow}</p>}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">{props.title}</h1>
        <button
          type="button"
          onClick={() => setSheet("menu")}
          aria-label="More for this delivery"
          className="tap-target flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface"
        >
          <Icon name="more" size={20} weight="bold" />
        </button>
      </div>

      {skippedDateIso && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-soft-mist px-4 py-3 text-sm">
          <Icon name="calendar" size={18} className="shrink-0" />
          <p className="min-w-0 flex-1">
            You&apos;re skipping <b className="font-semibold">{longDate(skippedDateIso)}</b>. Nothing comes that day.
          </p>
          <button type="button" disabled={pending} onClick={() => run(() => skipDate(deliveryId, skippedDateIso, false), `${shortDate(skippedDateIso)} is back on`)} className="shrink-0 font-semibold underline underline-offset-2">
            Undo
          </button>
        </div>
      )}

      {area.state === "ok" && dateIso && cutoffIso && left !== null ? (
        <div className="mt-3 rounded-2xl border border-hairline bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-pop/30">
              <Icon name="calendar" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold leading-tight">{longDate(dateIso)}</p>
              <p className="mt-0.5 text-sm text-muted">
                {DELIVERY_WINDOW}
                {props.areaName ? ` · ${props.areaName}` : ""}
              </p>
            </div>
            {props.dayOptions.length > 1 && (
              <button type="button" onClick={() => setSheet("day")} className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-sm font-semibold">
                Change day
              </button>
            )}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 border-t border-hairline pt-3 text-sm">
            <span className={`size-2 rounded-full border border-carbon ${left < 6 * 3_600_000 ? "bg-ember" : "bg-mint-pop"}`} aria-hidden />
            <span>
              Change until <b className="font-semibold">{cutoffLabel(cutoffIso)}</b>
            </span>
            <span className="text-muted" suppressHydrationWarning>
              · {timeLeft(left)}
            </span>
          </p>
          {props.isStanding && <p className="mt-1 text-xs text-muted">We&apos;ll remind you before it closes. Nothing is ordered until you confirm.</p>}
        </div>
      ) : area.state === "unserved" ? (
        <div className="mt-3 rounded-2xl border border-hairline bg-surface p-4">
          <p className="font-semibold">We don&apos;t deliver to {area.name} yet</p>
          <p className="mt-1 text-sm text-muted">We&apos;re growing area by area and we&apos;ll tell you when we reach you. You can still fill this order, or use an address in an area we cover.</p>
          <LinkButton href="/account/addresses?next=/basket" variant="secondary" size="sm" className="mt-3">
            Use another address
          </LinkButton>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-hairline bg-surface p-4">
          <p className="font-semibold">Where should we deliver?</p>
          <p className="mt-1 text-sm text-muted">Add your address and we&apos;ll show the days we come to you.</p>
          <LinkButton href="/account/addresses?next=/basket" size="sm" className="mt-3">
            Add your address
          </LinkButton>
        </div>
      )}

      {/* ⋯ for this delivery */}
      <BottomSheet open={sheet === "menu"} onClose={() => setSheet(null)} title="This delivery">
        <div className="grid gap-1">
          {dateIso && area.state === "ok" && (
            <MenuRow icon="calendar" title={`Skip ${shortDate(dateIso)}`} sub="Nothing comes that day. Your items stay for the week after." onClick={() => setSheet("skip")} />
          )}
          <div className="flex items-center gap-3 rounded-2xl px-2 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
              <Icon name="bell" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Remind me each week</b>
              <small className="block text-[13px] text-muted">We keep these items ready and message you before {dayName(props.day)}&apos;s order closes. Nothing is ordered until you confirm.</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={props.isStanding}
              aria-label="Remind me each week"
              disabled={pending}
              onClick={() => run(() => setWeeklyReminder(deliveryId, !props.isStanding), props.isStanding ? "Weekly reminder off" : "We'll remind you each week")}
              className={`relative h-7 w-12 shrink-0 rounded-full border border-carbon transition ${props.isStanding ? "bg-carbon" : "bg-soft-mist"}`}
            >
              <span className={`absolute top-0.5 size-5.5 rounded-full bg-paper-white shadow transition-[left] ${props.isStanding ? "left-[1.4rem]" : "left-0.5"}`} />
            </button>
          </div>
          <MenuRow icon="edit" title="Rename" sub={props.name ? `Called "${props.name}"` : "Give it a name, like “For Mum”"} onClick={() => setSheet("rename")} />
          {props.canAddMore ? (
            <MenuRow icon="plus" title="Another delivery" sub="For someone else, or a second drop in the week" onClick={() => setSheet("new")} />
          ) : (
            <MenuLink
              icon="plus"
              title="Another delivery"
              sub={props.member ? "Member Plus has as many as you need" : "Members can have up to three, for family or the office"}
              href={props.member ? "/subscribe?reason=basket-limit" : "/subscribe?reason=free-basket-used"}
            />
          )}
          {props.canRemove && <MenuRow icon="trash" title="Remove this delivery" sub="Its items go with it" onClick={() => setSheet("remove")} />}
        </div>
      </BottomSheet>

      {/* Change day */}
      <BottomSheet open={sheet === "day"} onClose={() => setSheet(null)} title="Delivery day">
        <p className="text-sm text-muted">{props.areaName ? `We come to ${props.areaName} on these days.` : "Pick a day."} Your items stay as they are.</p>
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
                    Next {shortDate(o.dateIso)} · change until {cutoffLabel(o.cutoffIso)}
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
        <p className="text-sm text-muted">Nothing comes that day and nothing is charged. Your items stay ready for the week after, and you can undo this until it closes.</p>
        <div className="mt-5 grid gap-2">
          <Button size="lg" loading={pending} onClick={() => dateIso && run(() => skipDate(deliveryId, dateIso, true), `Skipped ${shortDate(dateIso)}`)}>
            Skip this delivery
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setSheet(null)}>
            Keep it
          </Button>
        </div>
      </BottomSheet>

      {/* Rename */}
      <BottomSheet open={sheet === "rename"} onClose={() => setSheet(null)} title="Name this delivery">
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
            placeholder={`${dayName(props.day)}s`}
            aria-label="Delivery name"
            autoComplete="off"
            className="h-12 w-full rounded-control border border-hairline bg-surface px-4 text-base outline-none focus:border-carbon"
          />
          <p className="mt-1.5 text-xs text-muted">Leave it empty to call it by its day.</p>
          <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
            Save
          </Button>
        </form>
      </BottomSheet>

      {/* Remove */}
      <BottomSheet open={sheet === "remove"} onClose={() => setSheet(null)} title="Remove this delivery?">
        <p className="text-sm text-muted">Its items and its day go with it. Orders you&apos;ve already confirmed aren&apos;t affected.</p>
        <div className="mt-5 grid gap-2">
          <Button size="lg" variant="danger" loading={pending} onClick={() => run(() => removeDelivery(deliveryId), "Delivery removed")}>
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
