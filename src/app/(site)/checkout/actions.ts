"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasFreeDelivery, quoteDelivery } from "@/lib/pricing";
import { getSiteSettings } from "@/lib/site-settings";
import { transferReady } from "@/lib/site-settings-schema";
import { isBuyable } from "@/lib/product";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import { isMember, ownedDelivery, priceFor } from "@/lib/order-container";
import { getDeliveryCycle } from "@/lib/delivery";
import { ADDRESS_SELECT, addressLine, saveAddress, type AddressInput } from "@/lib/addresses";
import { creditBalance } from "@/lib/credit";
import { sendOrderConfirmation } from "@/lib/customer-emails";
import { notify } from "@/lib/notify";
import { appOrigin } from "@/lib/site";
import { formatNaira } from "@/lib/format";
import { cutoffLabel, longDate, orderRef } from "@/lib/delivery-labels";

export type PaymentChoice = "POD" | "TRANSFER";

export type CheckoutInput = {
  basketId: string;
  /** A saved address, or a new one to save first. */
  addressId: string | null;
  newAddress: AddressInput | null;
  name: string;
  phone: string;
  email: string;
  payment: PaymentChoice;
  useCredit: boolean;
};

export type CheckoutResult = { ok: false; error: string; addressId?: string };

const PAYMENT_LABEL: Record<PaymentChoice, string> = { POD: "Pay on delivery", TRANSFER: "Bank transfer" };
const LIVE = { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] };

/**
 * Place this week's order for one delivery. Prices, the delivery fee, the
 * date and credit are all worked out here, never taken from the page.
 * Nothing is charged: pay on delivery, or a transfer staff mark as paid.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const ip = await clientIp();
  if (!rateLimit(`checkout:ip:${ip}`, 10, 10 * 60 * 1000).ok) return { ok: false, error: "Too many tries. Give it a few minutes and try again." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to place this order." };
  const basket = await ownedDelivery(user.id, input.basketId);
  if (!basket) return { ok: false, error: "We couldn't find that order. Go back to Home and try again." };

  /* Contact */
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Add your name, so the rider knows who to ask for." };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Add a phone number the rider can call, like 0803 123 4567." };
  const email = input.email.trim().toLowerCase().slice(0, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email doesn't look right. Leave it empty if you'd rather not." };

  /* Where */
  let addressId = input.addressId;
  if (input.newAddress) {
    const saved = await saveAddress(user.id, input.newAddress);
    if (!saved.ok) return { ok: false, error: saved.error };
    addressId = saved.id;
  }
  const address = addressId ? await prisma.address.findFirst({ where: { id: addressId, userId: user.id }, select: ADDRESS_SELECT }) : null;
  if (!address) return { ok: false, error: "Pick where we should deliver.", addressId: addressId ?? undefined };
  if (!address.zone.isServed) return { ok: false, error: `We don't deliver to ${address.zone.name} yet. Pick another address.`, addressId: address.id };

  /* When */
  const cycle = await getDeliveryCycle(basket, address.zone);
  if (!cycle.date || !cycle.cutoff) return { ok: false, error: "We couldn't find a delivery date for that area. Message us and we'll sort it.", addressId: address.id };

  /* What */
  const items = await prisma.basketItem.findMany({ where: { basketId: basket.id }, include: { product: true } });
  const lines = items.filter((i) => isBuyable(i.product));
  if (!lines.length) return { ok: false, error: "Nothing in this order is in stock this week. Add something else from the shop.", addressId: address.id };

  const member = isMember(user);
  const snapshot = lines.map((i) => ({ productId: i.productId, name: i.product.name, unit: i.product.unit, quantity: i.quantity, unitPrice: priceFor(i.product, member) }));
  const subtotal = snapshot.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const settings = await getSiteSettings();
  const fee = quoteDelivery(subtotal, hasFreeDelivery(user.subscriptionTier?.slug), address.zone.deliveryFee, settings.delivery.freeThreshold).fee;
  const creditApplied = input.useCredit ? Math.min(await creditBalance(user.id), subtotal + fee) : 0;
  const total = subtotal + fee - creditApplied;

  if (input.payment === "TRANSFER" && !transferReady(settings.transfer)) return { ok: false, error: "Bank transfer isn't available right now. Choose pay on delivery.", addressId: address.id };
  const payment = input.payment === "TRANSFER" ? "TRANSFER" : "POD";

  /* One order per delivery per date */
  const order = await prisma.$transaction(async (tx) => {
    const clash = await tx.order.findFirst({ where: { basketId: basket.id, deliveryDate: cycle.date!, status: LIVE }, select: { id: true } });
    if (clash) return null;
    return tx.order.create({
      data: {
        accessToken: randomBytes(24).toString("base64url"),
        userId: user.id,
        deliveryZoneId: address.zone.id,
        orderType: "BASKET",
        status: "RECEIVED",
        customerName: name,
        customerPhone: phone,
        customerEmail: email || user.email || null,
        address: addressLine(address),
        landmark: address.landmark,
        deliveryNote: address.instructions,
        altPhone: address.altPhone,
        zoneName: address.zone.name,
        deliveryDate: cycle.date!,
        subtotal,
        deliveryFee: fee,
        creditApplied,
        total,
        paymentMethod: PAYMENT_LABEL[payment],
        paidAt: null,
        itemSnapshot: snapshot,
        basketId: basket.id,
        events: { create: { kind: "STATUS", toStatus: "RECEIVED", actorName: "Customer", note: `Order placed · ${PAYMENT_LABEL[payment]}` } },
        items: { create: snapshot.map((s) => ({ productId: s.productId, quantity: s.quantity, unitPrice: s.unitPrice })) },
      },
    });
  });
  if (!order) return { ok: false, error: "You've already confirmed an order for that day. It's on Home.", addressId: address.id };

  /* Tidy up around it */
  await Promise.all([
    // A delivery on the weekly reminder keeps its items ready for next week; a one-off starts empty.
    basket.isStanding ? null : prisma.basketItem.deleteMany({ where: { basketId: basket.id } }),
    basket.deliveryDay !== cycle.day ? prisma.basket.update({ where: { id: basket.id }, data: { deliveryDay: cycle.day } }) : null,
    rememberContact(user, name, phone),
  ]);

  const ref = orderRef(order.id);
  const link = `${appOrigin()}/orders/${order.id}?t=${encodeURIComponent(order.accessToken)}`;
  const payLine =
    payment === "TRANSFER"
      ? `Please transfer ${formatNaira(total)} to ${settings.transfer.accountName}, ${settings.transfer.bankName} ${settings.transfer.accountNumber}, with ${ref} as the reference.`
      : `Pay ${formatNaira(total)} when it arrives, by transfer or card.`;
  await Promise.all([
    sendOrderConfirmation({ ...order, items: snapshot.map((s) => ({ name: s.name, quantity: s.quantity })) }).catch(() => {}),
    notify({
      userId: user.id,
      kind: "order.placed",
      dedupeKey: `order.placed:${order.id}`,
      whatsapp: {
        to: phone,
        text: `Basket: order ${ref} is confirmed for ${longDate(cycle.date)}, 9am to 5pm. ${snapshot.length} items, ${formatNaira(total)}. ${payLine} You can change it until ${cutoffLabel(cycle.cutoff)}. ${link}`,
      },
    }).catch(() => {}),
  ]);

  revalidatePath("/basket");
  revalidatePath("/orders");
  redirect(`/orders/${order.id}?placed=1`);
}

/** Fill in the account's name and phone from the order if they were missing. */
async function rememberContact(user: { id: string; name: string | null; phone: string | null }, name: string, phone: string) {
  const data: { name?: string; phone?: string } = {};
  if (!user.name?.trim()) data.name = name;
  if (!user.phone) {
    const taken = await prisma.user.findFirst({ where: { phone: { in: phoneVariants(phone) }, NOT: { id: user.id } }, select: { id: true } });
    if (!taken) data.phone = phone;
  }
  if (Object.keys(data).length) await prisma.user.update({ where: { id: user.id }, data });
}
