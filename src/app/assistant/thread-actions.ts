"use server";

import { requireUser } from "@/lib/session";
import { listThreadsForUser, getOwnedThread, deleteThread } from "@/lib/assistant-threads";

export async function listMyThreads() {
  const user = await requireUser();
  return listThreadsForUser(user.id);
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
      .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content })),
  };
}

export async function deleteMyThread(threadId: string) {
  const user = await requireUser();
  await deleteThread(user.id, threadId);
}
