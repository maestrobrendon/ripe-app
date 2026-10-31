import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { DeliveryDay } from "@/generated/prisma/enums";
import type { KachiAccountChange, KachiCard } from "@/lib/kachi-types";
import { isMember } from "@/lib/order-container";
import { cutoffLabel, dayName, DELIVERY_WINDOW, longDate, WEEK_DAYS } from "@/lib/delivery-labels";
import { ISSUE_KINDS, type IssueKind } from "@/lib/order-copy";
import { renameDelivery, setDeliveryDay, setRepeating, skipDate } from "@/app/(site)/basket/actions";
import { reportIssue } from "@/app/(site)/orders/actions";
import type { deliveryScope } from "@/lib/kachi";
import { getDeliveryCycle } from "@/lib/delivery";

/*
 * Kachi's account tools: skip a week, change the day, pause or resume, rename,
 * and report a problem with an order. Each one calls the same server action
 * as the button on Home or the order page, so the same rules apply (cutoffs,
 * the area's days, membership for repeats) and ownership is checked from the
 * session, never from anything the model says. Every change comes back as a
 * card with Undo. Nothing here touches money.
 */

/** Same for every customer, so it sits in the cached part of her instructions. */
export const ACCOUNT_RULES = `Their basket and orders:
- You can skip or un-skip the next delivery, move the basket to another delivery day their area has, pause it or start it repeating again, and rename it. Do these when they clearly ask; the app shows a card with Undo. If it's unclear which they mean, ask one short question first.
- Only members' baskets repeat every week. If someone who isn't a member asks to start repeating, say it comes with a membership and they can see plans in Account.
- To see where an order is, call get_order_status. Use its words with them, and if a rider is on the way, give the rider's name and phone.
- Problems with an order that has arrived (something missing, bruised, wrong, not fresh, late or a no-show): ask what went wrong and which items, then call report_problem once. Tell them the team will get back to them, usually the same day. Don't promise a refund or credit; the team decides.
- You never move money. You can't cancel a paid order, refund, pay, or send a gift. To cancel before it closes they tap Cancel order on the order card on Home; gifts are sent from the Gift page (/gift). Say so plainly and warmly.`;

type Scope = Awaited<ReturnType<typeof deliveryScope>>;

/** What Kachi needs to know about the basket she's working on, beyond its items. Per customer. */
export function accountContext(user: CurrentUser, s: Scope) {
  const { delivery, zone, cycle } = s;
  const days = zone ? WEEK_DAYS.filter((d) => zone.deliveryDays.includes(d)).map(dayName) : [];
  return [
    `This basket comes on ${dayName(cycle.day)}${delivery.isStanding ? ", every week" : ", but it's paused (not repeating)"}.${delivery.name ? ` It's named "${delivery.name}".` : ""}`,
    cycle.date && cycle.cutoff ? `Next delivery: ${longDate(cycle.date)}, ${DELIVERY_WINDOW}. It can be changed or skipped until ${cutoffLabel(cycle.cutoff)}.` : "No next delivery date yet (no delivery address on the account).",
    cycle.skippedDate ? `They've skipped ${longDate(cycle.skippedDate)}.` : null,
    days.length ? `Their area gets deliveries on: ${days.join(", ")}.` : null,
    isMember(user) ? "They're a member." : "They're not a member, so this basket doesn't repeat by itself.",
  ]
    .filter(Boolean)
    .join("\n");
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const satisfies readonly DeliveryDay[];
const ISSUE_IDS = ISSUE_KINDS.map((k) => k.id) as [IssueKind, ...IssueKind[]];

/** The tools, pinned to the scoped basket. Each successful change is pushed onto `cards`. */
export function accountTools(user: CurrentUser, s: Scope, cards: KachiCard[]) {
  const basketId = s.delivery.id;
  const push = (change: KachiAccountChange) => cards.push({ type: "account", change });
  // After a change, the next date and its deadline can move: tell her the new ones, not the ones she started with.
  const nextUp = async () => {
    const basket = await prisma.basket.findUnique({ where: { id: basketId } });
    const cycle = basket ? await getDeliveryCycle(basket, s.zone) : null;
    return cycle?.date && cycle.cutoff ? { nextDelivery: longDate(cycle.date), canChangeUntil: cutoffLabel(cycle.cutoff) } : {};
  };

  return {
    skip_next_delivery: tool({
      description: "Skip the basket's next delivery (skip: true), or bring back a delivery they skipped (skip: false).",
      inputSchema: z.object({ skip: z.boolean() }),
      execute: async ({ skip }) => {
        const date = skip ? s.cycle.date : s.cycle.skippedDate;
        if (!date) return { ok: false, error: skip ? "There's no upcoming delivery to skip." : "Nothing is skipped right now." };
        const r = await skipDate(basketId, date.toISOString(), skip);
        if (!r.ok) return r;
        push({ kind: "skip", basketId, dateIso: date.toISOString(), skipped: skip });
        return { ok: true, data: { date: longDate(date), skipped: skip, ...(await nextUp()) } };
      },
    }),
    change_delivery_day: tool({
      description: "Move the basket to another delivery day their area has.",
      inputSchema: z.object({ day: z.enum(DAYS) }),
      execute: async ({ day }) => {
        const from = s.delivery.deliveryDay;
        if (from === day) return { ok: false, error: `It already comes on ${dayName(day)}.` };
        const r = await setDeliveryDay(basketId, day);
        if (!r.ok) return r;
        push({ kind: "day", basketId, from, to: day });
        return { ok: true, data: { from: dayName(from), to: dayName(day), ...(await nextUp()) } };
      },
    }),
    set_repeating: tool({
      description: "Pause the basket (on: false) so it stops coming, or start it repeating every week again (on: true, members only).",
      inputSchema: z.object({ on: z.boolean() }),
      execute: async ({ on }) => {
        if (s.delivery.isStanding === on) return { ok: false, error: on ? "It already comes every week." : "It's already paused." };
        const r = await setRepeating(basketId, on);
        if (!r.ok) return r;
        push({ kind: "repeat", basketId, on });
        return { ok: true, data: { repeating: on } };
      },
    }),
    rename_basket: tool({
      description: "Give the basket a name, like \"For Mum\" (up to 40 characters), or clear it with an empty name.",
      inputSchema: z.object({ name: z.string().max(40) }),
      execute: async ({ name }) => {
        const to = name.trim() || null;
        const r = await renameDelivery(basketId, to ?? "");
        if (!r.ok) return r;
        push({ kind: "rename", basketId, from: s.delivery.name, to });
        return { ok: true, data: { name: to } };
      },
    }),
    report_problem: tool({
      description: "Report a problem with one of their orders that has arrived (or was missed), so the team can put it right.",
      inputSchema: z.object({
        order_id: z.string(),
        kind: z.enum(ISSUE_IDS),
        items: z.array(z.string()).describe("Exact product names from the order that were affected, if any."),
        note: z.string().max(1000).describe("What happened, in a sentence or two, in the customer's words."),
      }),
      execute: async ({ order_id, kind, items, note }) => {
        const r = await reportIssue({ orderId: order_id, kind, items, note });
        if (!r.ok) return r;
        push({ kind: "report", orderId: order_id, label: ISSUE_KINDS.find((k) => k.id === kind)?.label ?? "A problem" });
        return { ok: true, data: { reported: true } };
      },
    }),
  };
}

/** Order status with what a customer asking "where is it?" needs: the rider, when it's out. */
export async function orderStatusForKachi(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true, deliveryDate: true, deliveredAt: true, total: true, paidAt: true, paymentMethod: true, deliveryRun: { select: { rider: { select: { name: true, phone: true } } } } },
  });
  if (!order) return null;
  return { order, rider: order.status === "OUT_FOR_DELIVERY" ? (order.deliveryRun?.rider ?? null) : null };
}
