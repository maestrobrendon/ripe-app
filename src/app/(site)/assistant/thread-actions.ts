"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { listThreadsForUser, getOwnedThread, deleteThread, appendMessage } from "@/lib/assistant-threads";
import { toolAddItemsToBasket, toolAddItemsToCart, toolAdjustCartItemQuantity, toolAdjustItemQuantity } from "@/lib/assistant-tools";
import { resolveScope, snapshot, diffSnapshots } from "@/lib/kachi";
import type { KachiCard, KachiChange, KachiListItem, KachiMode, KachiScope } from "@/lib/kachi-types";

function modeFor(scope: KachiScope): KachiMode {
  return scope.kind === "basket" ? { kind: "basket", basketId: scope.basketId } : { kind: "cart" };
}

function storedCards(toolCalls: unknown): KachiCard[] {
  if (toolCalls && typeof toolCalls === "object" && !Array.isArray(toolCalls)) {
    const cards = (toolCalls as { cards?: unknown }).cards;
    if (Array.isArray(cards)) return cards as KachiCard[];
  }
  return [];
}

export async function listMyThreads() {
  const user = await requireUser();
  const rows = await listThreadsForUser(user.id);
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt, messageCount: r._count.messages }));
}

export async function loadMyThread(threadId: string) {
  const user = await requireUser();
  const thread = await getOwnedThread(user.id, threadId);
  if (!thread) throw new Error("That chat doesn't belong to this account, or doesn't exist.");
  return {
    id: thread.id,
    title: thread.title,
    source: thread.source,
    messages: thread.messages
      .filter((m) => m.role !== "TOOL")
      .map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
        cards: storedCards(m.toolCalls),
      })),
  };
}

export async function deleteMyThread(threadId: string) {
  const user = await requireUser();
  await deleteThread(user.id, threadId);
}

/** "Add all" on a proposed list: the only way several items get added at once. */
export async function approveKachiList(
  threadId: string | null,
  scope: KachiScope,
  items: KachiListItem[],
): Promise<{ card: KachiCard | null; error?: string }> {
  const user = await requireUser();
  const resolved = await resolveScope(user, modeFor(scope));
  if (!resolved) return { card: null, error: "That basket isn't available any more." };

  const before = await snapshot(resolved);
  const lines = items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
  const result =
    resolved.kind === "basket"
      ? await toolAddItemsToBasket(user, { basket_id: resolved.basketId, items: lines })
      : await toolAddItemsToCart(user, { items: lines });
  if (!result.ok) return { card: null, error: result.error };

  const changes = await diffSnapshots(before, await snapshot(resolved));
  const card: KachiCard = { type: "act", scope, changes };
  if (threadId && (await getOwnedThread(user.id, threadId))) {
    await appendMessage(threadId, "ASSISTANT", "All in.", { cards: [card] });
  }
  revalidatePath("/basket");
  revalidatePath("/cart");
  return { card };
}

/** Undo on an action card: puts every changed product back to its quantity before the change. */
export async function undoKachiChanges(scope: KachiScope, changes: KachiChange[]): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const resolved = await resolveScope(user, modeFor(scope));
  if (!resolved) return { ok: false, error: "That basket isn't available any more." };

  for (const c of changes) {
    const quantity = Math.max(0, Math.round(c.before));
    const result =
      resolved.kind === "basket"
        ? await toolAdjustItemQuantity(user, { basket_id: resolved.basketId, product_id: c.productId, quantity })
        : await toolAdjustCartItemQuantity(user, { product_id: c.productId, quantity });
    if (!result.ok) return { ok: false, error: result.error };
  }
  revalidatePath("/basket");
  revalidatePath("/cart");
  return { ok: true };
}
