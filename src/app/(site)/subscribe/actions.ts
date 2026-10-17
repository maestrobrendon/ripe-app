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

function refresh() {
  revalidatePath("/subscribe");
  revalidatePath("/account");
}

async function requestPlan(user: NonNullable<CurrentUser>, tier: { id: string; name: string; monthlyFee: number }, deliveryDay: string | null) {
  if (!(await rateLimitShared(`plan-request:${user.id}`, 6, 60 * 60 * 1000)).ok) return;
  await prisma.$transaction([
    prisma.planRequest.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "WITHDRAWN", decidedAt: new Date() } }),
    prisma.planRequest.create({ data: { userId: user.id, tierId: tier.id, deliveryDay: isDeliveryDay(deliveryDay) ? deliveryDay : null } }),
  ]);
  await customerAudit(user, "plan.requested", `Asked to join ${tier.name}`);
  await sendPlanRequestReceived(user.email, user.name, tier.name, tier.monthlyFee);
}

export async function startSubscription(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/start");
  const slug = String(formData.get("tier") ?? "").slice(0, 60);
  const day = String(formData.get("deliveryDay") ?? "WEDNESDAY");
  const deliveryDay = isDeliveryDay(day) ? day : "WEDNESDAY";

  const tier = await prisma.subscriptionTier.findUnique({ where: { slug } });
  if (!tier) redirect("/subscribe?error=tier");

  if (selfServePlans()) {
    await activatePlan(user.id, tier.id, deliveryDay);
    await customerAudit(user, "plan.started", `Joined ${tier.name} (self-serve, local only)`);
    redirect("/basket");
  }
  await requestPlan(user, tier, deliveryDay);
  refresh();
  redirect("/subscribe?requested=1#plans");
}

export async function changeTier(slug: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const tier = await prisma.subscriptionTier.findUnique({ where: { slug: String(slug).slice(0, 60) } });
  if (!tier || tier.id === user.subscriptionTierId) return;
  const current = user.subscriptionTier;

  // Moving down (or sideways) costs nothing, so it happens at once.
  if (selfServePlans() || (current && tier.monthlyFee <= current.monthlyFee)) {
    await activatePlan(user.id, tier.id);
    await customerAudit(user, "plan.changed", `${current?.name ?? "No plan"} → ${tier.name}`);
  } else {
    await requestPlan(user, tier, null);
  }
  refresh();
}

export async function cancelSubscription() {
  const user = await getCurrentUser();
  if (!user) return;
  await endPlan(user.id);
  await customerAudit(user, "plan.cancelled", `Left ${user.subscriptionTier?.name ?? "their plan"}`);
  refresh();
}

export async function withdrawPlanRequest() {
  const user = await getCurrentUser();
  if (!user) return;
  const { count } = await prisma.planRequest.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
  if (count) await customerAudit(user, "plan.request_withdrawn", "Withdrew their plan request");
  refresh();
}
