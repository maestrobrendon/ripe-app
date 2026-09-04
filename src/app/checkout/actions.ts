"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readCart, getOrCreateCart, clearCart } from "@/lib/cart";
import { quoteDelivery } from "@/lib/pricing";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { DeliveryDay } from "@/generated/prisma/enums";

const DOW: Record<DeliveryDay, number> = { MONDAY: 1, WEDNESDAY: 3, FRIDAY: 5 };

function nextDeliveryDate(day: DeliveryDay): Date {
  const now = new Date();
  const diff = (DOW[day] - now.getDay() + 7) % 7 || 7;
  const result = new Date(now);
  result.setDate(now.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export type CheckoutInput = {
  name: string;
  phone: string;
  email: string;
  address: string;
  zoneSlug: string;
  deliveryDay: DeliveryDay;
  paymentMethod: "card" | "transfer";
};

export async function placeOrder(input: CheckoutInput) {
  const ip = await clientIp();
  if (!rateLimit(`checkout:ip:${ip}`, 10, 10 * 60 * 1000).ok) {
    throw new Error("Too many checkout attempts. Please try again in a few minutes.");
  }

  const [user, cart] = await Promise.all([getCurrentUser(), readCart()]);

  if (cart.items.length === 0) throw new Error("Your cart is empty.");
  const name = input.name.trim().slice(0, 120);
  const phone = input.phone.trim().slice(0, 32);
  const address = input.address.trim().slice(0, 400);
  if (!name || !phone || !address || !input.zoneSlug) {
    throw new Error("Please fill in your name, phone, address and zone.");
  }

  const zone = await prisma.deliveryZone.findUnique({ where: { slug: input.zoneSlug } });

  const isSubscriber = Boolean(user?.subscriptionTierId);
  const delivery = quoteDelivery(cart.subtotal, isSubscriber);
  const subtotal = cart.subtotal;
  const total = subtotal + delivery.fee;

  const snapshot = cart.items.map((i) => ({
    productId: i.productId,
    name: i.name,
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: isSubscriber ? i.memberPrice : i.standardPrice,
  }));

  const accessToken = randomBytes(24).toString("base64url");

  const order = await prisma.order.create({
    data: {
      accessToken,
      userId: user?.id ?? null,
      deliveryZoneId: zone?.id ?? null,
      orderType: "ONE_OFF",
      status: "RECEIVED",
      customerName: name,
      customerPhone: phone,
      customerEmail: (input.email || "").trim().slice(0, 254) || null,
      address,
      zoneName: zone?.name ?? input.zoneSlug,
      deliveryDate: nextDeliveryDate(input.deliveryDay),
      subtotal,
      deliveryFee: delivery.fee,
      total,
      paymentMethod: input.paymentMethod === "card" ? "Card (test mode)" : "Bank transfer (test mode)",
      itemSnapshot: snapshot,
      items: {
        create: snapshot.map((s) => ({
          productId: s.productId,
          quantity: s.quantity,
          unitPrice: s.unitPrice,
        })),
      },
    },
  });

  const activeCart = await getOrCreateCart();
  await clearCart(activeCart.id);

  // The token lets the buyer (guest or signed-in) view this one order.
  redirect(`/orders/${order.id}?t=${accessToken}`);
}
