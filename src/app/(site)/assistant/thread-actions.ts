"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { listThreadsForUser, getOwnedThread, deleteThread, appendMessage } from "@/lib/assistant-threads";
import { toolAddItemsToBasket, toolAdjustItemQuantity } from "@/lib/assistant-tools";
import { resolveScope, snapshot, diffSnapshots } from "@/lib/kachi";
import type { KachiAccountChange, KachiCard, KachiChange, KachiListItem, KachiMemoryNote, KachiMode, KachiScope } from "@/lib/kachi-types";
import { renameDelivery, setDeliveryDay, setRepeating, skipDate } from "@/app/(site)/basket/actions";
import { addMemory, removeMemory } from "@/lib/kachi-memory";

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
  if (!resolved || resolved.kind !== "basket") return { card: null, error: "That order isn't available any more." };

  const before = await snapshot(resolved);
  const lines = items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
  const result = await toolAddItemsToBasket(user, { basket_id: resolved.basketId, items: lines });
  if (!result.ok) return { card: null, error: result.error };

  const changes = await diffSnapshots(before, await snapshot(resolved));
  const card: KachiCard = { type: "act", scope, changes };
  if (threadId && (await getOwnedThread(user.id, threadId))) {
    await appendMessage(threadId, "ASSISTANT", "All in.", { cards: [card] });
  }
  revalidatePath("/basket");
  return { card };
}

/** Undo on an action card: puts every changed product back to its quantity before the change. */
export async function undoKachiChanges(scope: KachiScope, changes: KachiChange[]): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const resolved = await resolveScope(user, modeFor(scope));
  if (!resolved || resolved.kind !== "basket") return { ok: false, error: "That order isn't available any more." };

  for (const c of changes) {
    const quantity = Math.max(0, Math.round(c.before));
    const result = await toolAdjustItemQuantity(user, { basket_id: resolved.basketId, product_id: c.productId, quantity });
    if (!result.ok) return { ok: false, error: result.error };
  }
  revalidatePath("/basket");
  return { ok: true };
}

/**
 * Undo on a memory card: forgets what Kachi just remembered, or brings back
 * what she just forgot. Only ever the signed-in customer's own memories.
 */
export async function undoKachiMemory(action: "remembered" | "forgot", memory: KachiMemoryNote): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (action === "remembered") {
    await removeMemory(user.id, memory.id);
    return { ok: true };
  }
  const r = await addMemory(user.id, memory.kind, memory.text);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * Undo on an account card: puts the basket back the way it was, through the
 * same actions as Home's buttons (which check it's this customer's basket).
 * A problem report is a message to the team, so it has no Undo.
 */
export async function undoKachiAccount(change: KachiAccountChange): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  switch (change.kind) {
    case "skip":
      return skipDate(change.basketId, change.dateIso, !change.skipped);
    case "day":
      return setDeliveryDay(change.basketId, change.from);
    case "repeat":
      return setRepeating(change.basketId, !change.on);
    case "rename":
      return renameDelivery(change.basketId, change.from ?? "");
    case "report":
      return { ok: false, error: "A report goes straight to the team. Message us if you'd like to take it back." };
  }
}
