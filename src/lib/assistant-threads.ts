import "server-only";
import { prisma } from "@/lib/prisma";
import type { AssistantThreadSource, AssistantMessageRole } from "@/generated/prisma/enums";

const TITLE_MAX = 60;

export function deriveTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, " ");
  if (clean.length <= TITLE_MAX) return clean || "New chat";
  return clean.slice(0, TITLE_MAX - 1).trimEnd() + "…";
}

export async function listThreadsForUser(userId: string) {
  return prisma.assistantThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      source: true,
      contextRef: true,
      updatedAt: true,
      _count: { select: { messages: { where: { role: { in: ["USER", "ASSISTANT"] } } } } },
    },
  });
}

export async function getOwnedThread(userId: string, threadId: string) {
  return prisma.assistantThread.findFirst({
    where: { id: threadId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function createThread(
  userId: string,
  opts: { title: string; source?: AssistantThreadSource; contextRef?: string | null },
) {
  return prisma.assistantThread.create({
    data: {
      userId,
      title: opts.title,
      source: opts.source ?? "ASSISTANT",
      contextRef: opts.contextRef ?? null,
    },
  });
}

export async function appendMessage(
  threadId: string,
  role: AssistantMessageRole,
  content: string,
  toolCalls?: unknown,
) {
  await prisma.$transaction([
    prisma.assistantMessage.create({
      data: { threadId, role, content, toolCalls: toolCalls == null ? undefined : (toolCalls as object) },
    }),
    prisma.assistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
  ]);
}

export async function deleteThread(userId: string, threadId: string) {
  const result = await prisma.assistantThread.deleteMany({ where: { id: threadId, userId } });
  if (result.count === 0) throw new Error("That chat doesn't belong to this account, or doesn't exist.");
}

/** Last N messages of a thread, oldest first, in the {role, content} shape the model call expects. */
export async function recentMessagesForModel(threadId: string, limit: number) {
  const rows = await prisma.assistantMessage.findMany({
    where: { threadId, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows
    .reverse()
    .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }));
}
