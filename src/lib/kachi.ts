import "server-only";
import { prisma } from "@/lib/prisma";
import { getOrCreateActiveDelivery, isMember, ownedDelivery } from "@/lib/order-container";
import { getDeliveryCycle, zoneForUser } from "@/lib/delivery";
import { cutoffLabel, longDate, orderPhrase } from "@/lib/delivery-labels";
import type { CurrentUser } from "@/lib/session";
import { GOAL_LABEL, PRODUCE_PREFERENCE_LABEL } from "@/lib/format";
import {
  type KachiChange,
  type KachiListItem,
  type KachiMode,
  type KachiOrder,
  type KachiRecipe,
  type KachiScope,
} from "@/lib/kachi-types";
import { MENU_GOALS } from "@/lib/menu-types";
import { getMenu } from "@/lib/menu";

/**
 * A scope from an earlier card (Undo, Add all), trusted only if that delivery
 * really belongs to this customer. Signed-in customers have no cart, so an
 * old cart card resolves to nothing.
 */
export async function resolveScope(user: CurrentUser, mode: KachiMode): Promise<(KachiScope & { cartId?: string }) | null> {
  if (mode.kind !== "basket") return null;
  const basket = await ownedDelivery(user.id, mode.basketId);
  if (!basket) return null;
  return { kind: "basket", basketId: basket.id, name: orderPhrase(basket) };
}

/**
 * Where Kachi works: the delivery the customer is filling (the same one the
 * shop and recipes add to), and when it comes.
 */
export async function deliveryScope(user: CurrentUser): Promise<{ scope: KachiScope & { kind: "basket" }; when: string | null }> {
  const delivery = await getOrCreateActiveDelivery(user);
  const zone = await zoneForUser(user.id);
  const cycle = await getDeliveryCycle(delivery, zone);
  return {
    scope: { kind: "basket", basketId: delivery.id, name: orderPhrase(delivery) },
    when: cycle.date && cycle.cutoff ? `${longDate(cycle.date)}; they can change it until ${cutoffLabel(cycle.cutoff)}` : null,
  };
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

  // Prices follow membership, the same as checkout.
  const memberPriced = isMember(user);

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

/** The recipe library as prompt lines. It is small enough to hand over whole. */
export async function recipeLibrary() {
  const [stored, products, MENU] = await Promise.all([
    prisma.recipe.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, title: true, summary: true, goalTags: true, ingredientProductIds: true } }),
    prisma.product.findMany({ select: { id: true, name: true, slug: true } }),
    getMenu(),
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
      return `[[${r.slug}]] ${r.title}: ${r.summary}${time} Goals: ${r.goalLabel}. Ingredients we bring: ${uses}.${other}`;
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
    .replace(/([ \t]*)\[\[([a-z0-9-]+)\]\]/g, (_, space: string, slug: string, offset: number, whole: string) => {
      const r = bySlug.get(slug);
      if (!r) return "";
      if (!recipes.some((x) => x.slug === slug)) {
        recipes.push({ slug: r.slug, title: r.title, summary: r.summary, fromBasket: r.ingredientProductIds.length });
      }
      // The model sometimes writes the marker in place of the dish's name
      // ("1. [[slug]], crunchy…"). Then the name goes back in; when the name
      // is already right beside it, before or after, the marker just goes.
      const title = r.title.toLowerCase();
      const end = offset + _.length;
      const before = whole.slice(Math.max(0, offset - title.length - 12), offset).toLowerCase();
      const after = whole.slice(end, end + title.length + 12).toLowerCase();
      return before.includes(title) || after.includes(title) ? "" : `${space}${r.title}`;
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

// Asking where an order is, not just mentioning "my order" (the thing they fill).
export const ORDER_INTENT = /\b(where('s| is)?\s+(my\s+)?order|when (will|does|is) my order|track(ing)?|deliver(y|ed|ing)?|arriv\w*|on (its|the) way|rider|status)\b/i;
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

Write in plain, warm, short sentences, Nigerian kitchens in mind. Keep most replies under 80 words. Use a short numbered list only when listing options or steps. Never use em dashes; use commas or full stops instead. Never call yourself "AI", a "bot", or a "chatbot". You are Kachi. You give food guidance, not medical advice; for anything medical, their doctor comes first.

Basket is about food you eat, not drinks: never suggest smoothies, juices, shakes, teas or other drinks, as recipes or as ideas. Call what the customer is filling "your order" (for example "your Monday order"), never "basket" or "cart".`;

export const RECIPE_RULES = `Recipes: when a recipe from the library below fits, suggest it by writing its marker exactly as shown, for example [[green-mango-crunch-salad]], right after its name. The app turns each marker into a card the customer can open. Suggest at most three. Only use markers from the library; for anything else, describe it in words.`;

function ordersContext(orders: Orders) {
  if (orders.length === 0) return "This customer has no orders yet.";
  return orders
    .map((o) => `${o.id} :: ${o.status.toLowerCase().replace(/_/g, " ")}, delivery ${o.deliveryDate.toDateString()}`)
    .join("\n");
}

/** Kachi's one mode: food help, with tools pinned to the order the customer is filling. */
export function actingSystemPrompt(c: {
  firstName: string;
  profile: string;
  scope: KachiScope;
  when: string | null;
  page?: string | null;
  catalogueLines: string;
  orders: Orders;
  contentsLines: string;
  recipeLines: string;
}) {
  const where = c.scope.name;
  return `${VOICE}

You are helping ${c.firstName} with food: what to cook, what to buy, what goes well together, how to store produce, what to eat for a goal, and their orders. You can also read and change ${where}${c.when ? ` (it comes ${c.when})` : ""}, and nothing else. Use the tools to make real changes; never say something was changed unless a tool did it. You never place, confirm or pay for an order: the customer confirms it themselves on Home, and pays when it arrives. Only change the order when they ask for something to be added, removed or changed.

About ${c.firstName}:
${c.profile}
${c.page ? `
They are looking at this page right now: ${c.page}. If their question is vague ("this", "it"), it is probably about that.
` : ""}
Rules for changes:
- To add ONE product, call the add tool once.
- To add SEVERAL products (a shopping list, "fill my order for a gym week", or the ingredients for a recipe), call propose_items once with the whole list, sized for the household. Do not add them yourself. The customer approves the list with a button.
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
