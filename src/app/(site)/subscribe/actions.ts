"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimitShared } from "@/lib/rate-limit-db";
import { audit } from "@/lib/admin/audit";
import { activatePlan, endPlan, isDeliveryDay, selfServePlans } from "@/lib/plans";
import { sendPlanRequestReceived } from "@/lib/customer-emails";
import type { CurrentUser } from "@/lib/session";

/*
 * Joining or moving up a paid plan creates a request that Finance approves
 * once payment is confirmed (see src/lib/plans.ts). Moving down or
 * cancelling costs nothing and happens at once. Every change is audited.
 */

function customerAudit(user: NonNullable<CurrentUser>, action: string, summary: string) {
  // By id only: the audit log can't be edited, so no contact details go in it.
  return audit({ actorType: "CUSTOMER", actorId: user.id, action, targetType: "User", targetId: user.id, summary }).catch(() => {});
}

export type PlanResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/subscribe");
  revalidatePath("/account");
}

/** A request for Finance to approve once payment arrives. False when they've asked too often this hour. */
async function requestPlan(user: NonNullable<CurrentUser>, tier: { id: string; name: string; monthlyFee: number }, deliveryDay: string | null): Promise<boolean> {
  if (!(await rateLimitShared(`plan-request:${user.id}`, 6, 60 * 60 * 1000)).ok) return false;
  await prisma.$transaction([
    prisma.planRequest.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "WITHDRAWN", decidedAt: new Date() } }),
    prisma.planRequest.create({ data: { userId: user.id, tierId: tier.id, deliveryDay: isDeliveryDay(deliveryDay) ? deliveryDay : null } }),
  ]);
  await customerAudit(user, "plan.requested", `Asked to join ${tier.name}`);
  await sendPlanRequestReceived(user.email, user.name, tier.name, tier.monthlyFee);
  return true;
}

export async function startSubscription(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/start");
  const slug = String(formData.get("tier") ?? "").slice(0, 60);
  // Days belong to each basket now; joining doesn't change them.
  const day = formData.get("deliveryDay");
  const deliveryDay = isDeliveryDay(day) ? day : null;

  const tier = await prisma.subscriptionTier.findUnique({ where: { slug } });
  if (!tier) redirect("/subscribe?error=tier");

  if (selfServePlans()) {
    await activatePlan(user.id, tier.id, deliveryDay);
    await customerAudit(user, "plan.started", `Joined ${tier.name} (self-serve, local only)`);
    redirect("/basket");
  }
  const sent = await requestPlan(user, tier, deliveryDay);
  refresh();
  redirect(sent ? "/subscribe?requested=1#plans" : "/subscribe?error=too-many#plans");
}

export async function changeTier(slug: string): Promise<PlanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to change your plan." };
  const tier = await prisma.subscriptionTier.findUnique({ where: { slug: String(slug).slice(0, 60) } });
  if (!tier) return { ok: false, error: "That plan doesn't exist any more." };
  if (tier.id === user.subscriptionTierId) return { ok: true };
  const current = user.subscriptionTier;

  // Moving down (or sideways) costs nothing, so it happens at once.
  if (selfServePlans() || (current && tier.monthlyFee <= current.monthlyFee)) {
    await activatePlan(user.id, tier.id);
    await customerAudit(user, "plan.changed", `${current?.name ?? "No plan"} → ${tier.name}`);
  } else if (!(await requestPlan(user, tier, null))) {
    return { ok: false, error: "You've asked a few times this hour. We have your request; give it a little while." };
  }
  refresh();
  return { ok: true };
}

export async function cancelSubscription(): Promise<PlanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to cancel." };
  try {
    await endPlan(user.id);
  } catch {
    return { ok: false, error: "That didn't go through. Try again, or message us and we'll do it." };
  }
  await customerAudit(user, "plan.cancelled", `Left ${user.subscriptionTier?.name ?? "their plan"}`);
  refresh();
  revalidatePath("/basket");
  return { ok: true };
}

export async function withdrawPlanRequest(): Promise<PlanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const { count } = await prisma.planRequest.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
  if (count) await customerAudit(user, "plan.request_withdrawn", "Withdrew their plan request");
  refresh();
  return { ok: true };
}
