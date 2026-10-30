import "server-only";
import { prisma } from "@/lib/prisma";
import type { DeliveryDay } from "@/generated/prisma/enums";

/*
 * Membership plans. Joining or moving up a paid plan is paid online through
 * Paystack, and the plan starts once Paystack confirms it (src/lib/payments.ts).
 * Without Paystack it's a request (PlanRequest) that Finance approves in the
 * admin once a transfer is confirmed. Nothing on the site grants a paid plan
 * without a payment. Moving down or cancelling costs nothing, so it happens at once.
 *
 * Locally, PLAN_SELF_SERVE=1 restores instant plan changes so the member
 * experience can be tested without the admin. It is ignored in production.
 */

export const DELIVERY_DAYS: DeliveryDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export function selfServePlans(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.PLAN_SELF_SERVE === "1";
}

export function isDeliveryDay(v: unknown): v is DeliveryDay {
  return typeof v === "string" && (DELIVERY_DAYS as string[]).includes(v);
}

/**
 * Puts a customer on a plan: the tier and their delivery day. Prices follow
 * membership live, so every delivery they have is at member prices from now
 * on. A switch between plans keeps the original start date (it anchors the
 * monthly renewal).
 */
export async function activatePlan(userId: string, tierId: string, deliveryDay?: DeliveryDay | null): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { subscribedAt: true, subscriptionTierId: true, deliveryDay: true } });
    const day = deliveryDay ?? user.deliveryDay ?? "FRIDAY";
    await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionTierId: tierId,
        deliveryDay: day,
        subscribedAt: user.subscriptionTierId && user.subscribedAt ? user.subscribedAt : new Date(),
      },
    });
    // Membership is what makes baskets repeat: every basket they have now
    // comes every week. They get one if they had none.
    const first = await tx.basket.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (!first) await tx.basket.create({ data: { userId, isStanding: true, deliveryDay: day, pricingMode: "MEMBER" } });
    else {
      await tx.basket.updateMany({ where: { userId, oneOff: false }, data: { isStanding: true } });
      if (deliveryDay) await tx.basket.update({ where: { id: first.id }, data: { deliveryDay } });
    }
    // Whatever they were waiting on is settled by this.
    await tx.planRequest.updateMany({ where: { userId, status: "PENDING", tierId: { not: tierId } }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
  });
}

/** Back to paying as you go: standard prices from now on, on every delivery. Pending requests are withdrawn too. */
export async function endPlan(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { subscriptionTierId: null, subscribedAt: null } }),
    // Their baskets stay, with their items, but stop coming every week.
    prisma.basket.updateMany({ where: { userId }, data: { isStanding: false } }),
    prisma.planRequest.updateMany({ where: { userId, status: "PENDING" }, data: { status: "WITHDRAWN", decidedAt: new Date() } }),
  ]);
}

export function pendingPlanRequest(userId: string) {
  return prisma.planRequest.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" }, include: { tier: true } });
}
