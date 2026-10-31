import "server-only";
import { prisma } from "@/lib/prisma";
import type { KachiMemoryKind } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/session";
import { COOK_TIME_LABEL } from "@/lib/format";

/*
 * What Kachi remembers about a customer: lasting things they told her
 * ("no okra", "my son is allergic to groundnut"), kept across chats. She
 * writes them with her remember tool; the customer sees, edits and deletes
 * them in Account > What Kachi knows. Always scoped to the signed-in user.
 */

export const MEMORY_KINDS = ["ALLERGY", "DISLIKE", "LIKE", "HOUSEHOLD", "ROUTINE", "OTHER"] as const satisfies readonly KachiMemoryKind[];

/** Enough for a household's lasting facts; past this she should be forgetting, not piling up. */
const MAX_MEMORIES = 40;
export const MEMORY_TEXT_MAX = 140;

export type Memory = { id: string; kind: KachiMemoryKind; text: string };

/** Allergies first: they're the ones that must never be missed. */
const ORDER: Record<KachiMemoryKind, number> = { ALLERGY: 0, DISLIKE: 1, LIKE: 2, HOUSEHOLD: 3, ROUTINE: 4, OTHER: 5 };

export async function listMemories(userId: string): Promise<Memory[]> {
  const rows = await prisma.kachiMemory.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, text: true } });
  return rows.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, MEMORY_TEXT_MAX);

/** Saves one memory. Saying the same thing twice keeps the first, so a repeat isn't a duplicate. */
export async function addMemory(userId: string, kind: KachiMemoryKind, text: string): Promise<{ ok: true; memory: Memory; existing: boolean } | { ok: false; error: string }> {
  const t = clean(text);
  if (t.length < 2) return { ok: false, error: "That note is empty." };
  const all = await listMemories(userId);
  const same = all.find((m) => m.text.toLowerCase() === t.toLowerCase());
  if (same) return { ok: true, memory: same, existing: true };
  if (all.length >= MAX_MEMORIES) return { ok: false, error: `You already remember ${MAX_MEMORIES} things for this customer. Ask which one to forget first.` };
  const memory = await prisma.kachiMemory.create({ data: { userId, kind, text: t }, select: { id: true, kind: true, text: true } });
  return { ok: true, memory, existing: false };
}

export async function updateMemory(userId: string, id: string, kind: KachiMemoryKind, text: string): Promise<boolean> {
  const t = clean(text);
  if (t.length < 2) return false;
  const { count } = await prisma.kachiMemory.updateMany({ where: { id, userId }, data: { kind, text: t } });
  return count > 0;
}

/** Deletes one memory, returning what it was (for Undo), or null if it isn't theirs. */
export async function removeMemory(userId: string, id: string): Promise<Memory | null> {
  const m = await prisma.kachiMemory.findFirst({ where: { id, userId }, select: { id: true, kind: true, text: true } });
  if (!m) return null;
  await prisma.kachiMemory.deleteMany({ where: { id, userId } });
  return m;
}

export async function clearMemories(userId: string): Promise<number> {
  const { count } = await prisma.kachiMemory.deleteMany({ where: { userId } });
  return count;
}

const KIND_LABEL: Record<KachiMemoryKind, string> = {
  ALLERGY: "Allergy",
  DISLIKE: "Doesn't eat or like",
  LIKE: "Loves",
  HOUSEHOLD: "Household",
  ROUTINE: "Routine",
  OTHER: "Note",
};

/**
 * Everything Kachi knows about this customer beyond the basics, as prompt
 * lines: what they wrote in Account (dietary notes, favourites, cooking
 * time) and what she remembers, each memory with its id so she can forget it.
 */
export async function knownAboutCustomer(user: CurrentUser): Promise<string> {
  const prefs = user.preferences;
  const [memories, favourites] = await Promise.all([
    listMemories(user.id),
    prefs?.favoriteProductIds.length
      ? prisma.product.findMany({ where: { id: { in: prefs.favoriteProductIds } }, select: { name: true } })
      : Promise.resolve([]),
  ]);
  const lines: string[] = [];
  if (prefs?.dietaryNotes?.trim()) lines.push(`What they wrote in Account about their diet: "${prefs.dietaryNotes.trim()}". Treat any allergy in it exactly like a remembered allergy.`);
  if (favourites.length) lines.push(`Favourite products: ${favourites.map((f) => f.name).join(", ")}.`);
  if (prefs?.cookTimeAvailable) lines.push(`Time to cook on a normal day: ${COOK_TIME_LABEL[prefs.cookTimeAvailable] ?? prefs.cookTimeAvailable}.`);
  lines.push(
    memories.length
      ? `What you remember about them (id :: kind: note):\n${memories.map((m) => `${m.id} :: ${KIND_LABEL[m.kind]}: ${m.text}`).join("\n")}`
      : "You don't remember anything about them yet.",
  );
  return lines.join("\n");
}

/** How Kachi remembers and forgets, and why allergies are firm. Same for every customer, so it sits in the cached part. */
export const MEMORY_RULES = `Remembering:
- When the customer tells you something lasting about their food or household, call remember with a short note in plain words, the way they'd read it back ("No okra", "Son is allergic to groundnut", "Cooks for 5 on Sundays"). Lasting means it will still be true next week: allergies and intolerances, foods they don't eat or don't like, favourites, who they cook for, routines.
- Don't remember one-off requests ("add 2 pineapples"), moods, or anything you already remember. Don't remember health conditions other than food allergies and intolerances, anything about money, or anything not about food and their household.
- If they say something you remember is wrong or no longer true, or ask you to forget it, call forget with its id (and remember the corrected version if there is one).
- The app shows a card when you remember or forget something, so just carry on naturally; don't announce that you're saving it.
- If they ask what you know about them, tell them, and mention they can see and delete it all in Account under "What Kachi knows".

Allergies are firm:
- Never suggest, propose or add anything containing a food they're allergic to, including in recipes. Pick something else and, if it matters, say why in a few words.
- If they ask you to add a food they're allergic to, check with them first ("You told me you're allergic to groundnut, still add it?") and only add it once they confirm.
- Foods they don't eat or don't like: leave them out unless they ask for them.`;
