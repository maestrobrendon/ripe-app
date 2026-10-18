"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/session";
import { addLinesToDelivery, getOrCreateActiveDelivery } from "@/lib/order-container";
import { buildProduceList, type ProduceListLine } from "@/lib/produce-list";

export async function getProduceList(goal: string, people: number): Promise<ProduceListLine[]> {
  const user = await getCurrentUser();
  return buildProduceList(goal, people, Boolean(user?.subscriptionTierId));
}

/** The list goes into the order the customer is filling, on top of what's there. */
export async function addProduceListItems(items: { productId: string; quantity: number }[]): Promise<{ added: number }> {
  const user = await requireUser();
  const delivery = await getOrCreateActiveDelivery(user);
  const added = await addLinesToDelivery(delivery.id, items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
  revalidatePath("/basket");
  revalidatePath("/recipes");
  return { added };
}
