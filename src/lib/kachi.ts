import "server-only";
import { prisma } from "@/lib/prisma";
import { getOwnedBasket, getUserBaskets } from "@/lib/basket";
import { getOrCreateCart } from "@/lib/cart";
import type { CurrentUser } from "@/lib/session";
import { GOAL_LABEL, PRODUCE_PREFERENCE_LABEL } from "@/lib/format";
import {
  basketDisplayNames,
  type KachiChange,
  type KachiListItem,
  type KachiMode,
  type KachiOrder,
  type KachiScope,
} from "@/lib/kachi-types";

/**
 * Resolves a requested mode into a scope the server trusts: a basket only if
 * it really belongs to this user, the cart as this browser's cart. Returns
 * null for "chat" (nothing can change) or a basket that isn't theirs.
 */
export async function resolveScope(user: CurrentUser, mode: KachiMode): Promise<(KachiScope & { cartId?: string }) | null> {
  if (mode.kind === "chat") return null;
  if (mode.kind === "cart") {
    const cart = await getOrCreateCart();
    return { kind: "cart", name: "your cart", cartId: cart.id };
  }
  const basket = await getOwnedBasket(user.id, mode.basketId);
  if (!basket) return null;
  const names = basketDisplayNames(await getUserBaskets(user.id));
  return { kind: "basket", basketId: basket.id, name: names.get(basket.id) ?? "Your basket" };
}

/** Quantity per product in the scoped basket or cart, used to diff before and after a turn. */
export async function snapshot(scope: KachiScope & { cartId?: string }): Promise<Map<string, number>> {
  const rows =
    scope.kind === "basket"
      ? await prisma.basketItem.findMany({ where: { basketId: scope.basketId } })
      : await prisma.cartItem.findMany({ where: { cartId: scope.cartId ?? "" } });
  return new Map(rows.map((r) => [r.productId, r.quantity]));
}

/**
 * Every product whose quantity moved between two snapshots. Diffing the
 * result, rather than trusting which tools the model says it called, is
 * what guarantees every real change gets an action card (and an Undo).
 */
export async function diffSnapshots(before: Map<string, number>, after: Map<string, number>): Promise<KachiChange[]> {
  const ids = new Set([...before.keys(), ...after.keys()]);
  const moved = [...ids].filter((id) => (before.get(id) ?? 0) !== (after.get(id) ?? 0));
  if (moved.length === 0) return [];
  const products = await prisma.product.findMany({ where: { id: { in: moved } }, select: { id: true, name: true } });
  const names = new Map(products.map((p) => [p.id, p.name]));
  return moved.map((id) => ({
    productId: id,
    name: names.get(id) ?? "item",
    before: before.get(id) ?? 0,
    after: after.get(id) ?? 0,
  }));
}

function snapQty(raw: number, minOrderQty: number, stepQty: number) {
  const above = Math.max(0, raw - minOrderQty);
  return minOrderQty + Math.ceil(above / stepQty) * stepQty;
}

/** Turns a proposal into display lines priced the way that destination will actually charge. */
export async function buildListItems(
  user: CurrentUser,
  scope: KachiScope,
  items: { product_id: string; quantity: number }[],
): Promise<KachiListItem[]> {
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.product_id) } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  let memberPriced = Boolean(user.subscriptionTierId);
  if (scope.kind === "basket") {
    const basket = await prisma.basket.findUnique({ where: { id: scope.basketId }, select: { pricingMode: true } });
    memberPriced = basket?.pricingMode === "MEMBER";
  }

  const seen = new Set<string>();
  const lines: KachiListItem[] = [];
  for (const item of items) {
    const p = byId.get(item.product_id);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    lines.push({
      productId: p.id,
      name: p.name,
      imageEmoji: p.imageEmoji,
      cloudinaryPublicId: p.cloudinaryPublicId,
      unit: p.unit,
      quantity: snapQty(Math.max(1, Math.round(item.quantity)), p.minOrderQty, p.stepQty),
      unitPrice: memberPriced ? p.memberPrice : p.standardPrice,
    });
  }
  return lines;
}

export async function recentOrders(userId: string, take = 3) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, status: true, deliveryDate: true },
  });
}

export function toKachiOrder(o: { id: string; status: KachiOrder["status"]; deliveryDate: Date }): KachiOrder {
  return { id: o.id, status: o.status, deliveryDate: o.deliveryDate.toISOString() };
}

export const ORDER_INTENT = /\b(order|orders|deliver|delivery|delivered|arriv)/i;
export const CHANGE_INTENT = /^\s*(please\s+)?(add|put|remove|take out|delete|drop|fill my basket|fill my cart)\b/i;

/** The customer's food preferences (Account > Food preferences), as prompt context. */
export function aboutCustomer(user: CurrentUser) {
  const people = user.householdAdults + user.householdKids;
  const goal = user.preferences?.primaryGoal ? GOAL_LABEL[user.preferences.primaryGoal] ?? user.preferences.primaryGoal : null;
  const likes = (user.preferences?.producePreferences ?? []).map((p) => PRODUCE_PREFERENCE_LABEL[p] ?? p);
  return [
    `Household: ${user.householdAdults} ${user.householdAdults === 1 ? "adult" : "adults"}, ${user.householdKids} ${user.householdKids === 1 ? "child" : "children"} (${people} people). Size amounts for this many people unless told otherwise.`,
    goal ? `What they want most: ${goal}.` : null,
    likes.length ? `What they usually buy: ${likes.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const STYLE_RULES = `Write in plain, warm, short sentences. Never use em dashes; use commas or full stops instead. Never call yourself "AI", a "bot", or a "chatbot". You are Kachi.`;

function ordersContext(orders: { id: string; status: string; deliveryDate: Date }[]) {
  if (orders.length === 0) return "This customer has no orders yet.";
  return orders
    .map((o) => `${o.id} :: ${o.status.toLowerCase().replace(/_/g, " ")}, delivery ${o.deliveryDate.toDateString()}`)
    .join("\n");
}

/** Just chatting: food talk only, no tools, nothing can change. */
export function chatSystemPrompt(
  firstName: string,
  profile: string,
  orders: { id: string; status: string; deliveryDate: Date }[],
) {
  return `You are Kachi, the food companion inside Basket, a fruit and vegetable delivery service in Lagos. You are chatting with ${firstName}.

${STYLE_RULES}

About ${firstName}:
${profile}

Help with food: what to cook, what to buy, what goes well together, how to store produce, what to eat for a goal. Keep answers practical and short, Nigerian kitchens in mind. This is food guidance, not medical advice.

In this mode you cannot change anything in their basket or cart. If they ask you to add, remove or change something, tell them to pick a basket or the cart with the button above the message box, and do not pretend it was done.

Their recent orders (id :: status, delivery date):
${ordersContext(orders)}`;
}

/** Basket or cart mode: tools scoped to exactly one destination. */
export function actingSystemPrompt(
  firstName: string,
  profile: string,
  scope: KachiScope,
  catalogueLines: string,
  orders: { id: string; status: string; deliveryDate: Date }[],
) {
  const where = scope.kind === "basket" ? `their basket "${scope.name}"` : "their cart (a one-time purchase)";
  return `You are Kachi, Basket's ordering helper, working on ${where} for ${firstName}.

${STYLE_RULES}

About ${firstName}:
${profile}

You can read and change ${where}, and nothing else. Use the tools to make real changes; do not just describe what you would do.

Rules for changes:
- To add ONE product, call the add tool once.
- To add SEVERAL products (for example "fill my basket for a gym week" or a shopping list), call propose_items once with the whole list. Do not add them yourself. The customer approves the list with a button, so say something like "Here is what I would add. Nothing gets added until you say so."
- Removing or changing a quantity is fine to do directly.
- After a change, confirm it in one short sentence. The app shows a card with an Undo button, so do not repeat the item list.

Always pass exact product ids from the catalogue below. Never invent ids.

Recent orders (id :: status, delivery date):
${ordersContext(orders)}

Product catalogue (id :: name (unit, min order, step)):
${catalogueLines}`;
}
