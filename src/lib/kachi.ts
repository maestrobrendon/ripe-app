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
  type KachiRecipe,
  type KachiScope,
} from "@/lib/kachi-types";
import { MENU, MENU_GOALS } from "@/app/(bare)/home-menu/recipes";

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

/**
 * What is in a basket or cart right now, as prompt lines. Handing the model
 * the contents up front saves it a lookup call on most turns, which matters
 * on Gemini's per-minute quota.
 */
export async function contentsContext(contents: Map<string, number>) {
  if (contents.size === 0) return "Empty.";
  const products = await prisma.product.findMany({
    where: { id: { in: [...contents.keys()] } },
    select: { id: true, name: true, unit: true },
  });
  return products.map((p) => `${p.id} :: ${p.name}, ${contents.get(p.id)} x ${p.unit}`).join("\n");
}

/** The active basket's contents for chat mode, where Kachi can look but not touch. */
export async function activeBasketContext(userId: string) {
  const basket = await prisma.basket.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  if (!basket) return { basketId: null, lines: "This customer has no basket yet." };
  const rows = await prisma.basketItem.findMany({ where: { basketId: basket.id } });
  return { basketId: basket.id, lines: await contentsContext(new Map(rows.map((r) => [r.productId, r.quantity]))) };
}

/** The recipe library as prompt lines. It is small enough to hand over whole. */
export async function recipeLibrary() {
  const [stored, products] = await Promise.all([
    prisma.recipe.findMany({ select: { slug: true, title: true, summary: true, goalTags: true, ingredientProductIds: true } }),
    prisma.product.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const idBySlug = new Map(products.map((p) => [p.slug, p.id]));
  // The photographed menu (what the homepage, sign-up and /recipes lead
  // with) comes first, then the older library the meal plan uses. Both have
  // a /recipes/[slug] page, so a card from either opens.
  const menu = MENU.map((r) => ({
    slug: r.slug,
    title: r.title,
    summary: r.hook,
    goalLabel: MENU_GOALS.find((g) => g.id === r.goal)?.label ?? "",
    minutes: r.minutes as number | null,
    elsewhere: r.elsewhere,
    ingredientProductIds: r.basket.map((s) => idBySlug.get(s)).filter((id): id is string => Boolean(id)),
  }));
  const recipes = [
    ...menu,
    ...stored
      .filter((r) => !menu.some((m) => m.slug === r.slug))
      .map((r) => ({
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        goalLabel: r.goalTags.map((g) => GOAL_LABEL[g] ?? g).join(", "),
        minutes: null,
        elsewhere: [] as string[],
        ingredientProductIds: r.ingredientProductIds,
      })),
  ];
  const lines = recipes
    .map((r) => {
      const uses = r.ingredientProductIds.map((id) => `${names.get(id) ?? "?"} (${id})`).join(", ");
      const time = r.minutes ? ` ${r.minutes} min.` : "";
      const other = r.elsewhere.length ? ` From elsewhere: ${r.elsewhere.join(", ")}.` : "";
      return `[[${r.slug}]] ${r.title}: ${r.summary}${time} Goals: ${r.goalLabel}. Basket ingredients: ${uses}.${other}`;
    })
    .join("\n");
  return { lines: lines || "No recipes yet.", bySlug: new Map(recipes.map((r) => [r.slug, r])) };
}

/**
 * Pulls the [[slug]] recipe markers out of a reply and turns them into
 * recipe cards. Markers keep recipe suggestions to the one model call that
 * writes the reply, rather than a separate lookup tool.
 */
export function extractRecipes(
  text: string,
  bySlug: Map<string, { slug: string; title: string; summary: string; ingredientProductIds: string[] }>,
): { text: string; recipes: KachiRecipe[] } {
  const recipes: KachiRecipe[] = [];
  const cleaned = text
    .replace(/[ \t]*\[\[([a-z0-9-]+)\]\]/g, (_, slug: string) => {
      const r = bySlug.get(slug);
      if (r && !recipes.some((x) => x.slug === slug)) {
        recipes.push({ slug: r.slug, title: r.title, summary: r.summary, fromBasket: r.ingredientProductIds.length });
      }
      return "";
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: cleaned, recipes: recipes.slice(0, 3) };
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

/** The customer's food preferences (Account > Food preferences) and delivery zone, as prompt context. */
export function aboutCustomer(user: CurrentUser) {
  const people = user.householdAdults + user.householdKids;
  const goal = user.preferences?.primaryGoal ? GOAL_LABEL[user.preferences.primaryGoal] ?? user.preferences.primaryGoal : null;
  const likes = (user.preferences?.producePreferences ?? []).map((p) => PRODUCE_PREFERENCE_LABEL[p] ?? p);
  const zone = user.deliveryZone;
  const days = (zone?.deliveryDays ?? []).map((d) => d.charAt(0) + d.slice(1).toLowerCase());
  return [
    `Household: ${user.householdAdults} ${user.householdAdults === 1 ? "adult" : "adults"}, ${user.householdKids} ${user.householdKids === 1 ? "child" : "children"} (${people} people). Size amounts for this many people unless told otherwise.`,
    goal ? `What they want most: ${goal}.` : null,
    likes.length ? `What they usually buy: ${likes.join(", ")}.` : null,
    zone
      ? `Delivery zone: ${zone.name} (${zone.area}). Delivery days: ${days.join(", ") || "not set"}.`
      : "No delivery address on the account yet. They can add one in Account.",
  ]
    .filter(Boolean)
    .join("\n");
}

type Orders = { id: string; status: string; deliveryDate: Date }[];

export const VOICE = `You are Kachi, the meal planner inside Basket, a Lagos service that turns a food goal into recipes and the fresh produce to cook them.

Write in plain, warm, short sentences, Nigerian kitchens in mind. Keep most replies under 80 words. Use a short numbered list only when listing options or steps. Never use em dashes; use commas or full stops instead. Never call yourself "AI", a "bot", or a "chatbot". You are Kachi. You give food guidance, not medical advice; for anything medical, their doctor comes first.`;

export const RECIPE_RULES = `Recipes: when a recipe from the library below fits, suggest it by writing its marker exactly as shown, for example [[efo-riro]], right after its name. The app turns each marker into a card the customer can open. Suggest at most three. Only use markers from the library; for anything else, describe it in words.`;

function ordersContext(orders: Orders) {
  if (orders.length === 0) return "This customer has no orders yet.";
  return orders
    .map((o) => `${o.id} :: ${o.status.toLowerCase().replace(/_/g, " ")}, delivery ${o.deliveryDate.toDateString()}`)
    .join("\n");
}

/** Just chatting: Kachi can see the active basket but change nothing. */
export function chatSystemPrompt(c: { firstName: string; profile: string; orders: Orders; basketLines: string; recipeLines: string; page?: string | null }) {
  return `${VOICE}

You are chatting with ${c.firstName}. Help with food: what to cook, what to buy, what goes well together, how to store produce, what to eat for a goal, and questions about their basket and orders.

About ${c.firstName}:
${c.profile}
${c.page ? `
They are looking at this page right now: ${c.page}. If their question is vague ("this", "it"), it is probably about that.
` : ""}
In this mode you can see their basket but cannot change anything. If they ask you to add, remove, swap or change something in their basket or cart, reply with one short sentence saying you can do it, and end the reply with the marker [[where]]. The app then asks them where it should go. Never say a change was made.

${RECIPE_RULES}

Their current basket (id :: name, quantity x unit):
${c.basketLines}

Recent orders (id :: status, delivery date):
${ordersContext(c.orders)}

Recipe library:
${c.recipeLines}`;
}

/** Basket or cart mode: tools scoped to exactly one destination. */
export function actingSystemPrompt(c: {
  firstName: string;
  profile: string;
  scope: KachiScope;
  catalogueLines: string;
  orders: Orders;
  contentsLines: string;
  recipeLines: string;
}) {
  const where = c.scope.kind === "basket" ? `their basket "${c.scope.name}"` : "their cart (a one-time purchase)";
  return `${VOICE}

You are working on ${where} for ${c.firstName}. You can read and change ${where}, and nothing else. Use the tools to make real changes; never say something was changed unless a tool did it.

About ${c.firstName}:
${c.profile}

Rules for changes:
- To add ONE product, call the add tool once.
- To add SEVERAL products (a shopping list, "fill my basket for a gym week", or the ingredients for a recipe), call propose_items once with the whole list, sized for the household. Do not add them yourself. The customer approves the list with a button.
- Removing or changing a quantity is fine to do directly.
- "Remove the X" means remove all of it. "Remove one X" means lower the quantity by one.
- If a product they ask for is not in the catalogue, say so and offer the closest match.

${RECIPE_RULES}

What is in ${where} right now (id :: name, quantity x unit):
${c.contentsLines}

Recent orders (id :: status, delivery date):
${ordersContext(c.orders)}

Recipe library:
${c.recipeLines}

Product catalogue (id :: name (unit, min order, step)):
${c.catalogueLines}`;
}
