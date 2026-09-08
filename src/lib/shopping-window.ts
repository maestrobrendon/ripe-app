import type { ShoppingWindowDay } from "@/generated/prisma/enums";

/**
 * The three days a basket can be scheduled to ship on. Picking one sets when the
 * basket would go out if the customer checks out. It does not start a countdown
 * and it does not authorise a payment. Cutoff times are placeholders until ops
 * confirms them, same status as the subscription pricing tiers.
 */
export const SHOPPING_WINDOW_DAYS: {
  day: ShoppingWindowDay;
  label: string;
  dow: number;
  cutoffCopy: string;
}[] = [
  { day: "THURSDAY", label: "Thursday", dow: 4, cutoffCopy: "Orders for Thursday close at [cutoff time] on Wednesday" },
  { day: "FRIDAY", label: "Friday", dow: 5, cutoffCopy: "Orders for Friday close at [cutoff time] on Thursday" },
  { day: "SATURDAY", label: "Saturday", dow: 6, cutoffCopy: "Orders for Saturday close at [cutoff time] on Friday" },
];

export const SHOPPING_WINDOW_DAY_LABEL: Record<ShoppingWindowDay, string> = {
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

export function shoppingWindowConfig(day: ShoppingWindowDay) {
  return SHOPPING_WINDOW_DAYS.find((d) => d.day === day) ?? SHOPPING_WINDOW_DAYS[0];
}

/** The next future calendar date that falls on the given shopping window day. */
export function nextShoppingWindowDate(day: ShoppingWindowDay | null | undefined): Date {
  const target = day ? shoppingWindowConfig(day).dow : 4;
  const now = new Date();
  const diff = (target - now.getDay() + 7) % 7 || 7;
  const result = new Date(now);
  result.setDate(now.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
