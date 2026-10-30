"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { settlePayment, startMembershipPayment, startOrderPayment, type Settled, type StartResult } from "@/lib/payments";

/*
 * What the "Pay" buttons call. Each start is for the signed-in customer's own
 * order or plan, at the amount the server works out; confirming only ever
 * asks Paystack (settlePayment), so nothing the page sends can mark anything paid.
 */

async function limited(key: string) {
  const ip = await clientIp();
  return !rateLimit(`pay:${key}:${ip}`, 12, 10 * 60 * 1000).ok;
}

export async function payForOrder(orderId: string): Promise<StartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to pay for this order." };
  if (await limited("start")) return { ok: false, error: "Too many tries. Give it a few minutes and try again." };
  return startOrderPayment(user.id, String(orderId).slice(0, 40));
}

export async function payForPlan(tierSlug: string): Promise<StartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to join." };
  if (await limited("start")) return { ok: false, error: "Too many tries. Give it a few minutes and try again." };
  const tier = await prisma.subscriptionTier.findUnique({ where: { slug: String(tierSlug).slice(0, 60) }, select: { id: true } });
  if (!tier) return { ok: false, error: "We couldn't find that plan." };
  return startMembershipPayment(user.id, tier.id);
}

export async function confirmPayment(reference: string): Promise<Settled> {
  const user = await getCurrentUser();
  const ref = String(reference).slice(0, 40);
  // Only the customer who started it can prompt a check from the page.
  const mine = user ? await prisma.payment.findFirst({ where: { reference: ref, userId: user.id }, select: { id: true } }) : null;
  if (!mine) return { ok: false, status: "UNKNOWN", message: "We don't recognise that payment.", orderId: null };
  if (await limited("confirm")) return { ok: false, status: "PENDING", message: "Checking too often. Refresh in a minute.", orderId: null };
  return settlePayment(ref, "page");
}
