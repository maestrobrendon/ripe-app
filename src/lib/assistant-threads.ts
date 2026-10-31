import "server-only";
import { prisma } from "@/lib/prisma";
import type { ModelMessage } from "ai";
import type { KachiCard } from "@/lib/kachi-types";
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
  return rows.reverse().flatMap((m): ModelMessage[] => {
    if (m.role === "USER") return [{ role: "user", content: m.content }];
    // Her words alone don't say what she did. Replies saved with their tool calls and
    // results replay as they happened (call, result, reply), so she can see and trust
    // her own actions; older ones carry a note instead. Without either she sees
    // "skipped" later and thinks it was like that before she spoke.
    const replayed = replayCalls(m.id, m.toolCalls);
    if (replayed) return [...replayed, { role: "assistant", content: m.content }];
    const did = whatKachiDid(m.toolCalls);
    return [{ role: "assistant", content: did ? `${m.content}

(${did})` : m.content }];
  });
}

type StoredCall = { tool: string; input?: unknown; output?: unknown };

/** A reply's tool calls and their results as model messages, if they were saved with results. */
function replayCalls(messageId: string, toolCalls: unknown): ModelMessage[] | null {
  const calls = toolCalls && typeof toolCalls === "object" ? (toolCalls as { calls?: StoredCall[] }).calls : undefined;
  if (!Array.isArray(calls) || !calls.length || !calls.every((c) => c && typeof c.tool === "string" && "output" in c)) return null;
  const id = (i: number) => `h_${messageId}_${i}`;
  return [
    { role: "assistant", content: calls.map((c, i) => ({ type: "tool-call" as const, toolCallId: id(i), toolName: c.tool, input: c.input ?? {} })) },
    {
      role: "tool",
      content: calls.map((c, i) => ({ type: "tool-result" as const, toolCallId: id(i), toolName: c.tool, output: { type: "json" as const, value: (c.output ?? null) as never } })),
    },
  ];
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const title = (d: string) => d.charAt(0) + d.slice(1).toLowerCase();

/** A one-line account of the cards on one of Kachi's replies: the changes she made with it. */
function whatKachiDid(toolCalls: unknown): string | null {
  const cards = (toolCalls && typeof toolCalls === "object" && Array.isArray((toolCalls as { cards?: unknown }).cards) ? (toolCalls as { cards: KachiCard[] }).cards : []) as KachiCard[];
  const calls = (toolCalls && typeof toolCalls === "object" && Array.isArray((toolCalls as { calls?: unknown }).calls) ? (toolCalls as { calls: { tool: string; input?: { order_id?: string } }[] }).calls : []);
  const looked = calls.filter((c) => c.tool === "get_order_status").map((c) => `looked up order ${c.input?.order_id ?? ""}`.trim());
  const done = cards.flatMap((c): string[] => {
    switch (c.type) {
      case "act":
        return c.changes.map((x) => `set ${x.name} from ${x.before} to ${x.after}`);
      case "list":
        return [`showed a list of ${c.items.length} products for them to approve`];
      case "memory":
        return [`${c.action === "remembered" ? "remembered" : "forgot"} "${c.memory.text}"`];
      case "account": {
        const a = c.change;
        if (a.kind === "skip") return [`${a.skipped ? "skipped" : "brought back"} the delivery on ${fmtDay(a.dateIso)}`];
        if (a.kind === "day") return [`moved the basket from ${title(a.from)} to ${title(a.to)}`];
        if (a.kind === "repeat") return [a.on ? "started the basket repeating every week" : "paused the basket"];
        if (a.kind === "rename") return [a.to ? `renamed the basket "${a.to}"` : "cleared the basket's name"];
        return [`reported "${a.label}" on order ${a.orderId}`];
      }
      default:
        return [];
    }
  });
  const all = [...looked, ...done];
  return all.length ? `What you did with this reply: ${all.join("; ")}. They may have undone changes since; the details in your instructions show how things are now.` : null;
}
