// The Assistant's only way to touch the database. Every function here takes
// the authenticated user as an explicit, server-resolved argument (never a
// field the model can supply) and re-checks ownership and business rules
// itself, independent of anything the model asked for. A hallucinated or
// manipulated tool call fails here, at the data layer, not because the model
// "declined" — see the Mobile Nav and AI Agent addendum, Section 2.
//
// This is a convenience layer over the same rules the rest of the app
// enforces, not a shortcut past them: item mutations go through the same
// setBasketItemQuantity used by the basket UI, so window locks, the
// free-trial pricing lock, and quantity snapping all apply identically here.

import { prisma } from "@/lib/prisma";
import {
  getOwnedBasket,
  getUserBaskets,
  getBasketView,
  createUserBasket,
  BasketCapReachedError,
} from "@/lib/basket";
import { setBasketItemQuantity } from "@/app/basket/actions";
import type { CurrentUser } from "@/lib/session";

export type ToolResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Every executed call, successful or not: user, function, arguments, outcome.
 * Cheap to have now, per the addendum, and it's the only way to reconstruct
 * what happened to a customer's basket after the fact. Plain structured
 * console output — this app has no log aggregation of its own yet, and
 * Vercel already captures function logs, so this is the pragmatic floor
 * rather than a new logging system.
 */
function logToolCall(userId: string, fn: string, args: unknown, outcome: "ok" | "error", detail?: unknown) {
  console.log(
    JSON.stringify({
      scope: "assistant-tool",
      userId,
      fn,
      args,
      outcome,
      detail,
      at: new Date().toISOString(),
    }),
  );
}

async function requireOwnedBasket(userId: string, basketId: string) {
  const basket = await getOwnedBasket(userId, basketId);
  if (!basket) throw new Error("That basket doesn't belong to this account, or doesn't exist.");
  return basket;
}

async function run<T>(userId: string, fn: string, args: unknown, work: () => Promise<T>): Promise<ToolResult<T>> {
  try {
    const data = await work();
    logToolCall(userId, fn, args, "ok");
    return { ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Something went wrong.";
    logToolCall(userId, fn, args, "error", error);
    return { ok: false, error };
  }
}

export async function toolGetBasketContents(user: CurrentUser, args: { basket_id: string }) {
  return run(user.id, "get_basket_contents", args, async () => {
    await requireOwnedBasket(user.id, args.basket_id);
    const view = await getBasketView(args.basket_id);
    if (!view) throw new Error("Basket not found.");
    return {
      basketId: view.basket.id,
      isFreeTrial: view.basket.isFreeTrial,
      pricingMode: view.basket.pricingMode,
      shipDay: view.basket.shoppingWindowDay,
      items: view.basket.items.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        unit: i.product.unit,
        quantity: i.quantity,
      })),
      subtotal: view.effectiveSubtotal,
    };
  });
}

export async function toolAddItemToBasket(
  user: CurrentUser,
  args: { basket_id: string; product_id: string; quantity: number },
) {
  return run(user.id, "add_item_to_basket", args, async () => {
    await requireOwnedBasket(user.id, args.basket_id);
    const product = await prisma.product.findUnique({ where: { id: args.product_id } });
    if (!product) throw new Error("That product doesn't exist.");
    const existing = await prisma.basketItem.findUnique({
      where: { basketId_productId: { basketId: args.basket_id, productId: args.product_id } },
    });
    const nextQuantity = (existing?.quantity ?? 0) + Math.max(0, args.quantity);
    // Ownership already verified above, so this call's own resolveBasket
    // fallback never has a reason to trigger.
    await setBasketItemQuantity(args.basket_id, args.product_id, nextQuantity);
    return { productId: args.product_id, name: product.name, newQuantity: nextQuantity };
  });
}

export async function toolRemoveItemFromBasket(user: CurrentUser, args: { basket_id: string; product_id: string }) {
  return run(user.id, "remove_item_from_basket", args, async () => {
    await requireOwnedBasket(user.id, args.basket_id);
    await setBasketItemQuantity(args.basket_id, args.product_id, 0);
    return { productId: args.product_id, removed: true };
  });
}

export async function toolAdjustItemQuantity(
  user: CurrentUser,
  args: { basket_id: string; product_id: string; quantity: number },
) {
  return run(user.id, "adjust_item_quantity", args, async () => {
    await requireOwnedBasket(user.id, args.basket_id);
    const product = await prisma.product.findUnique({ where: { id: args.product_id } });
    if (!product) throw new Error("That product doesn't exist.");
    await setBasketItemQuantity(args.basket_id, args.product_id, Math.max(0, args.quantity));
    return { productId: args.product_id, name: product.name, quantity: Math.max(0, args.quantity) };
  });
}

export async function toolSwitchActiveBasket(user: CurrentUser, args: { basket_id: string }) {
  return run(user.id, "switch_active_basket", args, async () => {
    await requireOwnedBasket(user.id, args.basket_id);
    // "Active" basket is defined app-wide as the most recently touched one
    // (lib/basket.ts, getOrCreateActiveBasket) — touching updatedAt is what
    // actually makes a switch stick without inventing a second notion of
    // "active" just for the agent.
    await prisma.basket.update({ where: { id: args.basket_id }, data: { updatedAt: new Date() } });
    return { basketId: args.basket_id, switched: true };
  });
}

export async function toolCreateBasket(user: CurrentUser) {
  return run(user.id, "create_basket", {}, async () => {
    try {
      const basket = await createUserBasket(user.id, {
        isSubscriber: Boolean(user.subscriptionTierId),
        deliveryDay: user.deliveryDay ?? "WEDNESDAY",
      });
      return { basketId: basket.id, isFreeTrial: basket.isFreeTrial, pricingMode: basket.pricingMode };
    } catch (err) {
      if (err instanceof BasketCapReachedError) throw new Error(err.message);
      throw err;
    }
  });
}

export async function toolGetOrderStatus(user: CurrentUser, args: { order_id: string }) {
  return run(user.id, "get_order_status", args, async () => {
    const order = await prisma.order.findFirst({ where: { id: args.order_id, userId: user.id } });
    if (!order) throw new Error("No order with that id on this account.");
    return {
      orderId: order.id,
      status: order.status,
      deliveryDate: order.deliveryDate.toISOString(),
      total: order.total,
      paid: Boolean(order.paidAt),
    };
  });
}

export async function toolGetDeliveryZone(user: CurrentUser) {
  return run(user.id, "get_delivery_zone", {}, async () => {
    if (!user.deliveryZone) throw new Error("No delivery zone set on this account yet.");
    return {
      zone: user.deliveryZone.name,
      area: user.deliveryZone.area,
      deliveryDays: user.deliveryZone.deliveryDays,
    };
  });
}

/** For the model's own context, not itself a callable tool: the baskets this user can act on. */
export async function listBasketsForContext(user: CurrentUser) {
  const baskets = await getUserBaskets(user.id);
  return baskets.map((b) => ({
    id: b.id,
    isFreeTrial: b.isFreeTrial,
    pricingMode: b.pricingMode,
    shipDay: b.shoppingWindowDay,
  }));
}
