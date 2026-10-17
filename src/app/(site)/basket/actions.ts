"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { BasketCapReachedError } from "@/lib/basket";
import {
  addLinesToDelivery,
  createDelivery,
  getOrCreateActiveDelivery,
  ownedDelivery,
  rememberActiveDelivery,
} from "@/lib/order-container";
import { getDeliveryCycle, setDateSkipped, zoneForUser } from "@/lib/delivery";
import { cutoffFor } from "@/lib/delivery-dates";
import { buildStarterPicks } from "@/lib/starter-basket-core";
import { getStarterCandidates } from "@/lib/starter-basket";
import { MENU_GOALS } from "@/lib/menu-types";
import { getMenu } from "@/lib/menu";
import { BUYABLE } from "@/lib/product";
import { audit } from "@/lib/admin/audit";
import type { DeliveryDay } from "@/generated/prisma/enums";

/*
 * Home's actions. None of them throws at the customer: each returns ok, or a
 * sentence they can act on.
 */

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function mine(basketId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, basket: null };
  return { user, basket: await ownedDelivery(user.id, basketId) };
}

const done = (): Result => {
  revalidatePath("/basket");
  return { ok: true };
};

/** Look at another delivery (Home follows it, and so does everything added from other pages). */
export async function selectDelivery(basketId: string) {
  const { basket } = await mine(basketId);
  if (basket) await rememberActiveDelivery(basket.id);
  redirect("/basket");
}

/** Another delivery: "For Mum", on Saturdays. */
export async function newDelivery(input: { name: string; day: DeliveryDay }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");
  try {
    const basket = await createDelivery(user, input);
    await rememberActiveDelivery(basket.id);
  } catch (e) {
    if (e instanceof BasketCapReachedError) redirect(e.reason === "trial" ? "/subscribe?reason=free-basket-used" : "/subscribe?reason=basket-limit");
    throw e;
  }
  redirect("/basket");
}

export async function renameDelivery(basketId: string, name: string): Promise<Result> {
  const { basket } = await mine(basketId);
  if (!basket) return fail("We couldn't find that delivery.");
  await prisma.basket.update({ where: { id: basket.id }, data: { name: name.trim().slice(0, 40) || null } });
  return done();
}

/** Remove an extra delivery. The last one stays: it's where the customer's order lives. */
export async function removeDelivery(basketId: string): Promise<Result> {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return fail("We couldn't find that delivery.");
  if ((await prisma.basket.count({ where: { userId: user.id } })) <= 1) return fail("This is your only delivery, so it stays.");
  const open = await prisma.order.count({ where: { basketId: basket.id, status: { in: ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY"] } } });
  if (open) return fail("This delivery has an order on its way. Remove it after that arrives.");
  await prisma.basket.delete({ where: { id: basket.id } });
  const next = await prisma.basket.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  if (next) await rememberActiveDelivery(next.id);
  return done();
}

/** Move a delivery to another of its area's days. Never starts a checkout. */
export async function setDeliveryDay(basketId: string, day: DeliveryDay): Promise<Result> {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return fail("We couldn't find that delivery.");
  const zone = await zoneForUser(user.id);
  if (!zone) return fail("Add your delivery address first, so we know which days we come to you.");
  if (!zone.deliveryDays.includes(day)) return fail(`We don't come to ${zone.name} on that day.`);
  await prisma.basket.update({ where: { id: basket.id }, data: { deliveryDay: day } });
  return done();
}

/** "Remind me each week": the order stays ready and we message the customer before it closes. */
export async function setWeeklyReminder(basketId: string, on: boolean): Promise<Result> {
  const { basket } = await mine(basketId);
  if (!basket) return fail("We couldn't find that delivery.");
  await prisma.basket.update({ where: { id: basket.id }, data: { isStanding: on } });
  return done();
}

/** Skip (or un-skip) one delivery date, any time before it closes. */
export async function skipDate(basketId: string, dateIso: string, skip: boolean): Promise<Result> {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return fail("We couldn't find that delivery.");
  const zone = await zoneForUser(user.id);
  if (!zone) return fail("Add your delivery address first.");
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return fail("That date didn't look right.");
  const cutoff = cutoffFor(date, zone.cutoffHour);
  if (Date.now() >= cutoff.getTime()) return fail("That delivery has already closed.");
  await setDateSkipped(basket, date, cutoff, skip);
  return done();
}

/** Put a past order back in this delivery, replacing what's there ("Order these again"). */
export async function orderAgain(basketId: string, orderId: string): Promise<Result> {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return fail("We couldn't find that delivery.");
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id }, include: { items: true } });
  if (!order) return fail("We couldn't find that order.");
  await prisma.basketItem.deleteMany({ where: { basketId: basket.id } });
  const added = await addLinesToDelivery(basket.id, order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
  if (added < order.items.length) {
    revalidatePath("/basket");
    return fail(`${order.items.length - added} of those aren't available this week, so we left them out.`);
  }
  return done();
}

/** An empty order: start from the set we'd suggest for the customer's goal and household. */
export async function startFromGoal(basketId: string): Promise<Result> {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return fail("We couldn't find that delivery.");
  const goalSlug = user.preferences?.primaryGoal ?? MENU_GOALS[0].starterSlug;
  const picks = buildStarterPicks({ goalSlug, producePreferences: user.preferences?.producePreferences ?? [], adults: user.householdAdults, kids: user.householdKids }, await getStarterCandidates());
  if (!picks.length) return fail("We don't have enough in stock to put a set together right now. Browse the shop instead.");
  await addLinesToDelivery(basket.id, picks.map((p) => ({ productId: p.productId, quantity: p.quantity })));
  return done();
}

/** "Cook this week": add whatever a recipe needs that the order doesn't have. */
export async function addRecipeMissing(basketId: string, recipeSlug: string): Promise<Result & { added?: number }> {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return fail("We couldn't find that delivery.");
  const recipe = (await getMenu()).find((r) => r.slug === recipeSlug);
  if (!recipe) return fail("We couldn't find that recipe.");
  const have = new Set((await prisma.basketItem.findMany({ where: { basketId: basket.id }, select: { product: { select: { slug: true } } } })).map((i) => i.product.slug));
  const products = await prisma.product.findMany({ where: { slug: { in: recipe.basket.filter((s) => !have.has(s)) }, ...BUYABLE }, select: { id: true, minOrderQty: true } });
  const added = await addLinesToDelivery(basket.id, products.map((p) => ({ productId: p.id, quantity: p.minOrderQty })));
  revalidatePath("/basket");
  return { ok: true, added };
}

/** Cancel an order before its delivery closes, so the customer can change it and confirm again. */
export async function cancelOrder(orderId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in again to change this order.");
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id }, include: { deliveryZone: { select: { cutoffHour: true } } } });
  if (!order) return fail("We couldn't find that order.");
  if (order.status !== "RECEIVED") return fail("We've already started on this order. Message us and we'll help.");
  const cutoff = cutoffFor(order.deliveryDate, order.deliveryZone?.cutoffHour ?? 18);
  if (Date.now() >= cutoff.getTime()) return fail("This order has closed. Message us and we'll help.");
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "Cancelled by the customer",
      version: { increment: 1 },
      events: { create: { kind: "STATUS", fromStatus: "RECEIVED", toStatus: "CANCELLED", actorName: "Customer", note: "Cancelled by the customer before cutoff" } },
    },
  });
  await audit({ actorType: "CUSTOMER", actorId: user.id, action: "order.cancelled_by_customer", targetType: "Order", targetId: order.id, summary: "Cancelled before cutoff" });
  revalidatePath("/basket");
  revalidatePath("/orders");
  return { ok: true };
}

/** The next date this delivery can be ordered for, for the checkout link. */
export async function nextDateFor(basketId: string) {
  const { user, basket } = await mine(basketId);
  if (!user || !basket) return null;
  const cycle = await getDeliveryCycle(basket, await zoneForUser(user.id));
  return cycle.date?.toISOString() ?? null;
}

/** Make sure a signed-in customer has a delivery (used by pages that need one to exist). */
export async function ensureDelivery() {
  const user = await getCurrentUser();
  if (!user) return null;
  const d = await getOrCreateActiveDelivery(user);
  return d.id;
}
