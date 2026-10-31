"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/admin/audit";
import { clearMemories, MEMORY_KINDS, removeMemory, updateMemory } from "@/lib/kachi-memory";
import type { KachiMemoryNote } from "@/lib/kachi-types";

export type MemoryResult = { ok: true } | { ok: false; error: string };

const refresh = () => revalidatePath("/account/kachi");

export async function editMemory(id: string, kind: KachiMemoryNote["kind"], text: string): Promise<MemoryResult> {
  const user = await requireUser();
  if (!MEMORY_KINDS.includes(kind)) return { ok: false, error: "Pick what kind of note it is." };
  if (!(await updateMemory(user.id, id, kind, text))) return { ok: false, error: "Write a few words first." };
  refresh();
  return { ok: true };
}

export async function deleteMemory(id: string): Promise<MemoryResult> {
  const user = await requireUser();
  await removeMemory(user.id, id);
  refresh();
  return { ok: true };
}

export async function forgetEverything(): Promise<MemoryResult> {
  const user = await requireUser();
  const count = await clearMemories(user.id);
  await audit({ actorType: "CUSTOMER", actorId: user.id, action: "privacy.kachi_memory_cleared", targetType: "User", targetId: user.id, summary: `${count} memories` }).catch(() => {});
  refresh();
  return { ok: true };
}
