"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readCart, getOrCreateCart, clearCart } from "@/lib/cart";
import { checkMinimum, quoteDelivery } from "@/lib/pricing";
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
  const [user, cart] = await Promise.all([getCurrentUser(), readCart()]);

  if (cart.items.length === 0) throw new Error("Your cart is empty.");
  if (!checkMinimum(cart.subtotal).meetsMinimum) {
    throw new Error("Your cart is below the order minimum.");
  }
  if (!input.name || !input.phone || !input.address || !input.zoneSlug) {
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

  const order = await prisma.order.create({
    data: {
      userId: user?.id ?? null,
      deliveryZoneId: zone?.id ?? null,
      orderType: "ONE_OFF",
      status: "RECEIVED",
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email || null,
      address: input.address,
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

  redirect(`/orders/${order.id}`);
}
