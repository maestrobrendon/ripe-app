"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/session";
import { getOrCreateActiveBasket } from "@/lib/basket";
import { toolAddItemsToBasket, toolAddItemsToCart } from "@/lib/assistant-tools";
import { buildProduceList, type ProduceListLine } from "@/lib/produce-list";

export async function getProduceList(goal: string, people: number): Promise<ProduceListLine[]> {
  const user = await getCurrentUser();
  return buildProduceList(goal, people, Boolean(user?.subscriptionTierId));
}

/** Free accounts always go to the cart; members choose cart or basket. */
export async function addProduceListItems(
  items: { productId: string; quantity: number }[],
  destination: "cart" | "basket",
): Promise<{ added: number }> {
  const user = await requireUser();

  if (destination === "cart") {
    const result = await toolAddItemsToCart(user, {
      items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    });
    revalidatePath("/cart");
    return { added: result.ok ? result.data.added.length : 0 };
  }

  if (!user.subscriptionTierId) throw new Error("Choosing a basket is a member feature.");
  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: true,
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const result = await toolAddItemsToBasket(user, {
    basket_id: basket.id,
    items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
  });
  revalidatePath("/basket");
  return { added: result.ok ? result.data.added.length : 0 };
}
