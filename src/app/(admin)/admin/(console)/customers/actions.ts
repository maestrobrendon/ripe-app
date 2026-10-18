"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { appOrigin } from "@/lib/site";
import { rateLimitShared } from "@/lib/rate-limit-db";
import { activatePlan, endPlan } from "@/lib/plans";
import { sendPlanDecision } from "@/lib/customer-emails";
import { notify } from "@/lib/notify";

/*
 * Staff actions on customer accounts. Contact details stay masked until a
 * logged reveal; anything that changes what a customer pays, or removes their
 * data, needs a fresh second factor (see STEP_UP in permissions.ts).
 *
 * Audit entries name the customer by id only, never by name or contact: the
 * audit log can't be edited, and an erased customer must not live on in it.
 */

const id = z.string().min(1).max(40);

function done(userId: string) {
  revalidatePath(`/customers/${userId}`);
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

async function findCustomer(userId: string) {
  const parsed = id.safeParse(userId);
  return parsed.success ? prisma.user.findUnique({ where: { id: parsed.data }, include: { subscriptionTier: true } }) : null;
}

const NOT_FOUND = { ok: false as const, code: "INVALID" as const, error: "That customer doesn't exist." };

export async function revealCustomerContact(userId: string): Promise<ActionResult<{ email: string | null; phone: string | null; address: string | null }>> {
  return staffAction("customers.reveal_pii", async (ctx) => {
    const user = await findCustomer(userId);
    if (!user) return NOT_FOUND;
    await auditStaff(ctx, { action: "customers.pii_revealed", targetType: "User", targetId: user.id, summary: "Revealed contact details" });
    return { ok: true, data: { email: user.email, phone: user.phone, address: user.address } };
  });
}

export async function addCustomerNote(input: { userId: string; body: string }): Promise<ActionResult> {
  return staffAction("customers.notes", async (ctx) => {
    const parsed = z.object({ userId: id, body: z.string().trim().min(1).max(2000) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Write a note (up to 2,000 characters)." };
    const user = await findCustomer(parsed.data.userId);
    if (!user) return NOT_FOUND;
    await prisma.customerNote.create({ data: { userId: user.id, body: parsed.data.body, staffId: ctx.staff.id, staffName: ctx.staff.name } });
    await auditStaff(ctx, { action: "customers.note_added", targetType: "User", targetId: user.id, summary: "Added a note" });
    done(user.id);
    return { ok: true, data: undefined };
  });
}

export async function sendCustomerPasswordReset(userId: string): Promise<ActionResult> {
  return staffAction("customers.manage", async (ctx) => {
    const user = await findCustomer(userId);
    if (!user) return NOT_FOUND;
    if (!user.email) return { ok: false, code: "CONFLICT", error: "This customer has no email address, so a reset link can't be sent." };
    if (!(await rateLimitShared(`admin-cust-reset:${user.id}`, 3, 60 * 60 * 1000)).ok) {
      return { ok: false, code: "RATE_LIMIT", error: "A reset was sent recently. Ask them to check their inbox and spam folder." };
    }
    const token = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user.email, `${appOrigin()}/reset-password?token=${token}`);
    await auditStaff(ctx, { action: "customers.password_reset_sent", targetType: "User", targetId: user.id, summary: "Sent a password reset link" });
    return { ok: true, data: undefined };
  });
}

export async function signOutCustomer(userId: string): Promise<ActionResult<{ count: number }>> {
  return staffAction("customers.manage", async (ctx) => {
    const user = await findCustomer(userId);
    if (!user) return NOT_FOUND;
    const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });
    await auditStaff(ctx, { action: "customers.signed_out", targetType: "User", targetId: user.id, summary: `Ended ${count} session(s)` });
    done(user.id);
    return { ok: true, data: { count } };
  });
}

export async function setCustomerSuspended(input: { userId: string; suspend: boolean; reason?: string }): Promise<ActionResult> {
  return staffAction("customers.manage", async (ctx) => {
    const parsed = z.object({ userId: id, suspend: z.boolean(), reason: z.string().trim().max(300).optional() }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Give a short reason." };
    const { suspend, reason } = parsed.data;
    if (suspend && !reason) return { ok: false, code: "INVALID", error: "Say why the account is being paused. Only staff see this." };
    const user = await findCustomer(parsed.data.userId);
    if (!user) return NOT_FOUND;
    if (user.erasedAt) return { ok: false, code: "CONFLICT", error: "This account was erased." };
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: suspend ? { suspendedAt: new Date(), suspendedReason: reason } : { suspendedAt: null, suspendedReason: null } }),
      ...(suspend ? [prisma.session.deleteMany({ where: { userId: user.id } })] : []),
    ]);
    await auditStaff(ctx, {
      action: suspend ? "customers.suspended" : "customers.unsuspended",
      targetType: "User",
      targetId: user.id,
      summary: suspend ? `Paused the account: ${reason}` : "Restored the account",
    });
    done(user.id);
    return { ok: true, data: undefined };
  });
}

/** Puts a customer on a plan (or none) directly, e.g. a complimentary or corrected plan. */
export async function setCustomerPlan(input: { userId: string; tierSlug: string | null; reason: string }): Promise<ActionResult> {
  return staffAction("customers.plan", async (ctx) => {
    const parsed = z.object({ userId: id, tierSlug: z.string().max(60).nullable(), reason: z.string().trim().min(3).max(300) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Pick a plan and say why." };
    const user = await findCustomer(parsed.data.userId);
    if (!user) return NOT_FOUND;
    if (user.erasedAt) return { ok: false, code: "CONFLICT", error: "This account was erased." };
    const tier = parsed.data.tierSlug ? await prisma.subscriptionTier.findUnique({ where: { slug: parsed.data.tierSlug } }) : null;
    if (parsed.data.tierSlug && !tier) return { ok: false, code: "INVALID", error: "That plan doesn't exist." };
    if ((tier?.id ?? null) === user.subscriptionTierId) return { ok: true, data: undefined };

    if (tier) await activatePlan(user.id, tier.id);
    else await endPlan(user.id);
    await auditStaff(ctx, {
      action: "customers.plan_changed",
      targetType: "User",
      targetId: user.id,
      summary: `${user.subscriptionTier?.name ?? "Pay as you go"} → ${tier?.name ?? "Pay as you go"} (${parsed.data.reason})`,
      diff: { plan: [user.subscriptionTier?.slug ?? null, tier?.slug ?? null], reason: parsed.data.reason },
    });
    done(user.id);
    return { ok: true, data: undefined };
  });
}

/** Finance's decision on a customer's request to join or move up a plan. */
export async function decidePlanRequest(input: { requestId: string; approve: boolean; note?: string }): Promise<ActionResult> {
  return staffAction("subscriptions.manage", async (ctx) => {
    const parsed = z.object({ requestId: id, approve: z.boolean(), note: z.string().trim().max(300).optional() }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That decision isn't valid." };
    const { requestId, approve, note } = parsed.data;
    const req = await prisma.planRequest.findUnique({ where: { id: requestId }, include: { tier: true, user: true } });
    if (!req) return { ok: false, code: "INVALID", error: "That request doesn't exist." };
    if (req.status !== "PENDING") return { ok: false, code: "CONFLICT", error: "That request was already settled." };
    if (req.user.erasedAt) return { ok: false, code: "CONFLICT", error: "This account was erased." };

    // Claim the request first, so two people approving at once can't both act on it.
    const { count } = await prisma.planRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "DECLINED", decidedAt: new Date(), decidedById: ctx.staff.id, decidedNote: note || null },
    });
    if (!count) return { ok: false, code: "CONFLICT", error: "That request was already settled." };
    if (approve) await activatePlan(req.userId, req.tierId, req.deliveryDay);

    await auditStaff(ctx, {
      action: approve ? "subscriptions.request_approved" : "subscriptions.request_declined",
      targetType: "User",
      targetId: req.userId,
      summary: `${approve ? "Approved" : "Declined"} a ${req.tier.name} request${note ? `: ${note}` : ""}`,
    });
    await sendPlanDecision(req.user.email, req.user.name, req.tier.name, approve, note);
    done(req.userId);
    return { ok: true, data: undefined };
  });
}

/**
 * Erases a customer's personal data on their request (Nigeria Data Protection
 * Act). Orders stay, for the accounts, but lose the name, phone, email and
 * address; everything else personal is deleted. Can't be undone.
 */
export async function eraseCustomer(input: { userId: string; confirm: string }): Promise<ActionResult> {
  return staffAction("customers.erase", async (ctx) => {
    const parsed = z.object({ userId: id, confirm: z.string().max(200) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Type the customer's name to confirm." };
    const user = await findCustomer(parsed.data.userId);
    if (!user) return NOT_FOUND;
    if (user.erasedAt) return { ok: false, code: "CONFLICT", error: "This account was already erased." };
    if (parsed.data.confirm.trim() !== user.name.trim()) return { ok: false, code: "INVALID", error: "The name you typed doesn't match. Nothing was erased." };

    const uid = user.id;
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: uid } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: uid } }),
      prisma.userPreferences.deleteMany({ where: { userId: uid } }),
      prisma.streakStatus.deleteMany({ where: { userId: uid } }),
      prisma.savedRecipe.deleteMany({ where: { userId: uid } }),
      prisma.weeklyMealPlan.deleteMany({ where: { userId: uid } }),
      prisma.ownMeal.deleteMany({ where: { userId: uid } }),
      prisma.producePlan.deleteMany({ where: { userId: uid } }),
      prisma.assistantThread.deleteMany({ where: { userId: uid } }),
      prisma.shoppingWindow.deleteMany({ where: { userId: uid } }),
      prisma.cartItem.deleteMany({ where: { cart: { userId: uid } } }),
      prisma.cart.deleteMany({ where: { userId: uid } }),
      prisma.basket.deleteMany({ where: { userId: uid } }),
      prisma.customerNote.deleteMany({ where: { userId: uid } }),
      prisma.planRequest.deleteMany({ where: { userId: uid } }),
      ...(user.email ? [prisma.waitlistSignup.deleteMany({ where: { email: user.email } })] : []),
      prisma.order.updateMany({ where: { userId: uid }, data: { customerName: "Erased customer", customerPhone: "erased", customerEmail: null, address: "erased" } }),
      prisma.user.update({
        where: { id: uid },
        data: {
          name: "Erased customer",
          email: null,
          phone: null,
          passwordHash: null,
          address: null,
          paymentCardBrand: null,
          paymentCardLast4: null,
          paymentCardExpiry: null,
          subscriptionTierId: null,
          subscribedAt: null,
          suspendedAt: null,
          suspendedReason: null,
          erasedAt: new Date(),
        },
      }),
    ]);
    // The audit row keeps the fact of the erasure, not the data erased.
    await auditStaff(ctx, { action: "customers.erased", targetType: "User", targetId: uid, summary: "Erased a customer's personal data on request" });
    done(uid);
    return { ok: true, data: undefined };
  });
}

/**
 * For a customer who signed up with a phone number only: a reset link staff
 * send on WhatsApp themselves (there's no SMS provider). It works once, for
 * 30 minutes, and making one is recorded.
 */
export async function createCustomerResetLink(userId: string): Promise<ActionResult<{ link: string; phone: string | null }>> {
  return staffAction("customers.manage", async (ctx) => {
    const user = await findCustomer(userId);
    if (!user) return NOT_FOUND;
    if (user.erasedAt) return { ok: false, code: "CONFLICT", error: "This account was erased." };
    if (!(await rateLimitShared(`admin-cust-reset-link:${user.id}`, 5, 60 * 60 * 1000)).ok) {
      return { ok: false, code: "RATE_LIMIT", error: "Several links were made this hour. Use the last one, or wait a little." };
    }
    const token = await createPasswordResetToken(user.id);
    const link = `${appOrigin()}/reset-password?token=${token}`;
    await auditStaff(ctx, { action: "customers.reset_link_created", targetType: "User", targetId: user.id, summary: "Made a password reset link to send by hand" });
    // Logged for the WhatsApp provider when there is one; staff send it today.
    await notify({ userId: user.id, kind: "auth.reset_link", dedupeKey: `reset-link:${user.id}:${Date.now()}`, essential: true, whatsapp: { to: user.phone, text: `Basket: here's your link to set a new password. It works once, for 30 minutes: ${link}` } }).catch(() => {});
    return { ok: true, data: { link, phone: user.phone } };
  });
}
