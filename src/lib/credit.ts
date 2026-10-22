import "server-only";
import { prisma } from "@/lib/prisma";

/*
 * Account credit: naira a customer can spend on their next orders. It comes
 * from CreditRecord rows of kind CREDIT (invite rewards, goodwill for a
 * problem with a delivery) and is spent through Order.creditApplied. Refunds
 * (kind REFUND) go back to the payment method instead and aren't credit.
 */

/** What the customer can spend right now. */
export async function creditBalance(userId: string): Promise<number> {
  const [earned, spent] = await Promise.all([
    prisma.creditRecord.aggregate({ where: { userId, kind: "CREDIT" }, _sum: { amount: true } }),
    prisma.order.aggregate({ where: { userId, status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { creditApplied: true } }),
  ]);
  return Math.max(0, (earned._sum.amount ?? 0) - (spent._sum.creditApplied ?? 0));
}

/** Give a customer credit. */
export function grantCredit(input: { userId: string; amount: number; reason: string; orderId?: string | null; staffId?: string | null; staffName: string }) {
  return prisma.creditRecord.create({
    data: { kind: "CREDIT", userId: input.userId, orderId: input.orderId ?? null, amount: Math.max(0, Math.round(input.amount)), reason: input.reason.slice(0, 300), method: "Account credit", staffId: input.staffId ?? null, staffName: input.staffName },
  });
}
