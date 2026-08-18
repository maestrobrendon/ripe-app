"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";

function nextDeliveryDate(day: "MONDAY" | "WEDNESDAY" | "FRIDAY"): Date {
  const targetDow = { MONDAY: 1, WEDNESDAY: 3, FRIDAY: 5 }[day];
  const now = new Date();
  const diff = (targetDow - now.getDay() + 7) % 7 || 7;
  const result = new Date(now);
  result.setDate(now.getDate() + diff);
  return result;
}

export async function placeOrder() {
  const user = await requireUser();
  const view = await getStandingBasketView(user.id);

  if (!view || view.basket.items.length === 0) {
    throw new Error("Your basket is empty.");
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      type: "STANDING",
      status: "RECEIVED",
      deliveryDate: nextDeliveryDate(view.basket.deliveryDay),
      total: view.memberSubtotal,
      items: {
        create: view.basket.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.product.memberPrice,
        })),
      },
    },
  });

  redirect(`/orders/${order.id}`);
}
