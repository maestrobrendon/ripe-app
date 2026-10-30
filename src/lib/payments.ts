import "server-only";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { initializeTransaction, paystackReady, verifyTransaction, type StartedPayment } from "@/lib/paystack";
import { activatePlan } from "@/lib/plans";
import { audit } from "@/lib/admin/audit";
import { sendPaymentReceipt } from "@/lib/customer-emails";
import { notify } from "@/lib/notify";
import { appOrigin } from "@/lib/site";
import { formatNaira } from "@/lib/format";
import { orderRef } from "@/lib/delivery-labels";
import { deliverGift } from "@/lib/gifts";

/*
 * Online payments, through Paystack. Two things are paid for: an order (any
 * order that isn't paid yet, whatever was chosen at checkout), and a month of
 * membership. Starting one writes a PENDING Payment and opens Paystack's
 * checkout; nothing is ever charged without the customer completing it there.
 *
 * A payment counts only once Paystack confirms it (settlePayment): the amount
 * and currency must match what we asked for. It is settled by whichever comes
 * first, the page that took the payment or Paystack's webhook, and settling
 * twice changes nothing. Membership is still never renewed automatically: each
 * month is a payment the member chooses to make.
 */

/** Refreshes a page's cache; outside a request (a script) there's nothing to refresh. */
function refresh(...paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      /* no request context */
    }
  }
}

const PAYABLE_STATUSES = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_DELIVERY"] as const;

function newReference() {
  return `BSK-PAY-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** How Paystack's channel reads to a customer. */
export function channelLabel(channel: string | null, last4?: string | null): string {
  switch (channel) {
    case "card":
      return last4 ? `card ending ${last4}` : "card";
    case "bank":
      return "bank account";
    case "bank_transfer":
      return "bank transfer";
    case "ussd":
      return "USSD";
    default:
      return "Paystack";
  }
}

export type StartResult = ({ ok: true } & StartedPayment & { publicKey: string }) | { ok: false; error: string };

function started(p: StartedPayment): StartResult {
  return { ok: true, ...p, publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "" };
}

/** Opens a payment for what's still owed on one of the customer's orders. */
export async function startOrderPayment(userId: string, orderId: string): Promise<StartResult> {
  if (!paystackReady()) return { ok: false, error: "Paying online isn't available right now. Pay on delivery or by transfer." };
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, total: true, paidAt: true, status: true, customerEmail: true, accessToken: true, user: { select: { email: true } } },
  });
  if (!order) return { ok: false, error: "We couldn't find that order." };
  if (order.paidAt) return { ok: false, error: "This order is already paid." };
  if (!(PAYABLE_STATUSES as readonly string[]).includes(order.status)) return { ok: false, error: "This order can't be paid for any more." };
  if (order.total <= 0) return { ok: false, error: "There's nothing left to pay on this order." };
  const email = order.customerEmail ?? order.user?.email;
  if (!email) return { ok: false, error: "Add an email to your account first: Paystack sends your receipt there." };

  const reference = newReference();
  await prisma.payment.create({ data: { reference, kind: "ORDER", amount: order.total, userId, orderId: order.id } });
  try {
    return started(
      await initializeTransaction({
        email,
        amount: order.total,
        reference,
        callbackUrl: `${appOrigin()}/api/payments/paystack/callback`,
        metadata: { kind: "ORDER", orderId: order.id, order: orderRef(order.id) },
      }),
    );
  } catch (e) {
    await prisma.payment.update({ where: { reference }, data: { status: "FAILED", failureReason: String((e as Error).message).slice(0, 300) } });
    return { ok: false, error: "We couldn't open the payment just now. Try again in a moment." };
  }
}

/** Opens a payment for one month of a plan. The plan starts the moment it's confirmed. */
export async function startMembershipPayment(userId: string, tierId: string): Promise<StartResult> {
  if (!paystackReady()) return { ok: false, error: "Paying online isn't available right now." };
  const [user, tier] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.subscriptionTier.findUnique({ where: { id: tierId }, select: { id: true, name: true, monthlyFee: true } }),
  ]);
  if (!user || !tier) return { ok: false, error: "We couldn't find that plan." };
  if (!user.email) return { ok: false, error: "Add an email to your account first: Paystack sends your receipt there." };
  if (tier.monthlyFee <= 0) return { ok: false, error: "This plan is free: there's nothing to pay." };

  const reference = newReference();
  await prisma.payment.create({ data: { reference, kind: "MEMBERSHIP", amount: tier.monthlyFee, userId, tierId: tier.id } });
  try {
    return started(
      await initializeTransaction({
        email: user.email,
        amount: tier.monthlyFee,
        reference,
        callbackUrl: `${appOrigin()}/api/payments/paystack/callback`,
        metadata: { kind: "MEMBERSHIP", tierId: tier.id, plan: tier.name },
      }),
    );
  } catch (e) {
    await prisma.payment.update({ where: { reference }, data: { status: "FAILED", failureReason: String((e as Error).message).slice(0, 300) } });
    return { ok: false, error: "We couldn't open the payment just now. Try again in a moment." };
  }
}

/** Opens a payment for a gift basket the customer is sending. */
export async function startGiftPayment(userId: string, giftId: string): Promise<StartResult> {
  if (!paystackReady()) return { ok: false, error: "Paying online isn't available right now." };
  const gift = await prisma.gift.findFirst({ where: { id: giftId, senderId: userId, status: "PENDING" }, include: { sender: { select: { email: true } } } });
  if (!gift) return { ok: false, error: "We couldn't find that gift. Start again." };
  if (!gift.sender.email) return { ok: false, error: "Add an email to your account first: Paystack sends your receipt there." };
  const reference = newReference();
  await prisma.payment.create({ data: { reference, kind: "GIFT", amount: gift.amount, userId, giftId: gift.id } });
  try {
    return started(
      await initializeTransaction({
        email: gift.sender.email,
        amount: gift.amount,
        reference,
        callbackUrl: `${appOrigin()}/api/payments/paystack/callback`,
        metadata: { kind: "GIFT", giftId: gift.id, for: gift.recipientName },
      }),
    );
  } catch (e) {
    await prisma.payment.update({ where: { reference }, data: { status: "FAILED", failureReason: String((e as Error).message).slice(0, 300) } });
    return { ok: false, error: "We couldn't open the payment just now. Try again in a moment." };
  }
}

export type Settled =
  | { ok: true; kind: "ORDER" | "MEMBERSHIP" | "GIFT"; orderId: string | null; accessToken: string | null; alreadySettled: boolean; giftCode?: string }
  | { ok: false; status: "PENDING" | "FAILED" | "ABANDONED" | "UNKNOWN"; message: string; orderId: string | null };

/**
 * Asks Paystack what happened to a payment and records it. Safe to call any
 * number of times, from the page, the redirect or the webhook.
 */
export async function settlePayment(reference: string, source: "page" | "callback" | "webhook"): Promise<Settled> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { order: { select: { id: true, accessToken: true, customerEmail: true, customerPhone: true, paidAt: true } }, tier: true, gift: true, user: { select: { email: true, name: true, phone: true } } },
  });
  if (!payment) return { ok: false, status: "UNKNOWN", message: "We don't recognise that payment.", orderId: null };
  const orderId = payment.orderId;
  if (payment.status === "SUCCESS") return { ok: true, kind: payment.kind, orderId, accessToken: payment.order?.accessToken ?? null, alreadySettled: true, giftCode: payment.gift?.code };

  let tx;
  try {
    tx = await verifyTransaction(reference);
  } catch {
    return { ok: false, status: "PENDING", message: "We couldn't check with Paystack just now. If you've paid, it will show here shortly.", orderId };
  }

  if (tx.status !== "success") {
    // Paystack calls a payment that was opened but not finished "abandoned" until it's paid, and the
    // customer may still be paying (a transfer can take minutes), so only a failure is final.
    const failed = tx.status === "failed" || tx.status === "reversed";
    if (failed) await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED", failureReason: tx.gatewayResponse?.slice(0, 300) } });
    return {
      ok: false,
      status: failed ? "FAILED" : "PENDING",
      message: failed
        ? tx.gatewayResponse
          ? `The payment didn't go through: ${tx.gatewayResponse}. Nothing was charged; you can try again.`
          : "The payment didn't go through. Nothing was charged; you can try again."
        : tx.status === "abandoned"
          ? "The payment isn't finished yet. Nothing has been charged."
          : "Your payment is still processing. It will show here once your bank confirms it.",
      orderId,
    };
  }

  // Paid, but for the right amount? Anything short is left for staff to look at.
  if (tx.currency !== "NGN" || Math.round(tx.amount) < payment.amount) {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED", failureReason: `Paid ${tx.currency} ${tx.amount}, expected NGN ${payment.amount}` } });
    await audit({ actorType: "SYSTEM", action: "payment.mismatch", targetType: "Payment", targetId: payment.id, summary: `Paystack ${reference}: paid ${tx.currency} ${tx.amount}, expected NGN ${payment.amount}` }).catch(() => {});
    return { ok: false, status: "FAILED", message: "That payment didn't match the amount due. We'll look into it and be in touch.", orderId };
  }

  const how = channelLabel(tx.channel, tx.cardLast4);
  const paidAt = tx.paidAt ?? new Date();
  // Only the first caller to flip it from PENDING applies its effect.
  const flipped = await prisma.payment.updateMany({
    where: { reference, status: { not: "SUCCESS" } },
    data: { status: "SUCCESS", paidAt, channel: tx.channel, cardLast4: tx.cardLast4, gatewayId: String(tx.id), failureReason: null },
  });
  if (flipped.count === 0) return { ok: true, kind: payment.kind, orderId, accessToken: payment.order?.accessToken ?? null, alreadySettled: true, giftCode: payment.gift?.code };

  if (payment.kind === "ORDER" && payment.order) {
    const order = payment.order;
    if (!order.paidAt) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paidAt,
          paymentMethod: `Paid online (${how})`,
          version: { increment: 1 },
          events: { create: { kind: "NOTE", actorName: "Paystack", note: `Paid ${formatNaira(payment.amount)} online by ${how} · Paystack ${reference}` } },
        },
      });
    }
    const link = `${appOrigin()}/orders/${order.id}?t=${encodeURIComponent(order.accessToken)}`;
    await Promise.all([
      sendPaymentReceipt(order.customerEmail ?? payment.user.email, { amount: payment.amount, what: `order ${orderRef(order.id)}`, how, reference, link, linkLabel: "See your order" }).catch(() => {}),
      notify({
        userId: payment.userId,
        kind: "order.paid",
        dedupeKey: `order.paid:${reference}`,
        whatsapp: order.customerPhone ? { to: order.customerPhone, text: `Basket: we've received ${formatNaira(payment.amount)} for order ${orderRef(order.id)}. Thank you. ${link}` } : undefined,
      }).catch(() => {}),
    ]);
    refresh(`/orders/${order.id}`, "/orders", "/basket");
  }

  if (payment.kind === "MEMBERSHIP" && payment.tier) {
    const pending = await prisma.planRequest.findFirst({ where: { userId: payment.userId, tierId: payment.tier.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    await activatePlan(payment.userId, payment.tier.id, pending?.deliveryDay ?? null);
    if (pending) await prisma.planRequest.update({ where: { id: pending.id }, data: { status: "APPROVED", decidedAt: new Date(), decidedNote: `Paid online · Paystack ${reference}` } });
    await sendPaymentReceipt(payment.user.email, {
      amount: payment.amount,
      what: `a month of ${payment.tier.name}`,
      how,
      reference,
      link: `${appOrigin()}/basket`,
      linkLabel: "Open your basket",
    }).catch(() => {});
    refresh("/account", "/subscribe", "/basket");
  }

  if (payment.kind === "GIFT" && payment.gift) {
    await prisma.gift.updateMany({ where: { id: payment.gift.id, status: "PENDING" }, data: { status: "ACTIVE", paidAt } });
    await deliverGift(payment.gift.id).catch(() => {});
    await sendPaymentReceipt(payment.user.email, {
      amount: payment.amount,
      what: `a gift basket for ${payment.gift.recipientName}`,
      how,
      reference,
      link: `${appOrigin()}/gift/${payment.gift.code}`,
      linkLabel: "See the gift",
    }).catch(() => {});
    refresh("/gift", "/account");
  }

  await audit({ actorType: "SYSTEM", action: "payment.received", targetType: "Payment", targetId: payment.id, summary: `${formatNaira(payment.amount)} ${payment.kind.toLowerCase()} payment by ${how} (${source})` }).catch(() => {});
  return { ok: true, kind: payment.kind, orderId, accessToken: payment.order?.accessToken ?? null, alreadySettled: false, giftCode: payment.gift?.code };
}

/** The last month of membership the customer paid for online, if any. */
export function lastMembershipPayment(userId: string) {
  return prisma.payment.findFirst({ where: { userId, kind: "MEMBERSHIP", status: "SUCCESS" }, orderBy: { paidAt: "desc" }, include: { tier: { select: { name: true } } } });
}
