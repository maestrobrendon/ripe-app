"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { clock, since, track } from "@/lib/analytics";
import type { KachiReply, KachiScope } from "@/lib/kachi-types";
import type { CardState } from "@/components/kachi/kachi-cards";
import { approveKachiList, undoKachiAccount, undoKachiChanges, undoKachiMemory } from "@/app/(site)/assistant/thread-actions";

/*
 * One conversation with the signed-in Kachi (api/assistant): the messages,
 * sending, Try again, and every card's buttons (Undo, Add all, Skip). Shared
 * by the full chat (/assistant) and the floating bubble, so both behave the
 * same.
 */

export type ConversationMsg = {
  id: string;
  role: "me" | "kachi";
  text: string;
  cards: CardState[];
  typing?: boolean;
  replies?: string[];
  /** The message to send again when this reply was a failure. */
  retry?: string;
};

export const AFTER_CHANGE_REPLIES = ["What can I make with it?", "What else goes well?"];

let seq = 0;
export const newMsgId = () => `m${Date.now()}-${seq++}`;

export const scopeName = (s: KachiScope) => (s.kind === "cart" ? "your cart" : s.name);

/**
 * What of a reply still being written can be shown: without the NEXT line of
 * suggested replies (or the start of one) and the [[recipe]] markers, which
 * become buttons and cards when the reply is done.
 */
export function visibleSoFar(raw: string) {
  let t = raw;
  const next = t.search(/\n?\s*NEXT:/i);
  if (next >= 0) t = t.slice(0, next);
  return (
    t
      .replace(/\n\s*N(E(XT?)?)?$/i, "")
      // A marker sometimes stands in for the dish's name ("My pick is [[pawpaw-boats]], …"): show
      // the name from its slug until the finished reply brings the real title, unless it's already there.
      .replace(/([ \t]*)\[\[([a-z0-9-]+)\]\]/g, (m, space: string, slug: string, offset: number, whole: string) => {
        const name = slug.replace(/-/g, " ");
        const near = whole.slice(Math.max(0, offset - name.length - 12), offset + m.length + name.length + 12).toLowerCase();
        return near.replace(m.toLowerCase(), "").includes(name) ? "" : `${space}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
      })
      .replace(/\s*\[\[?[^\]]*$/, "")
      .trimEnd()
  );
}

/** Reads the route's NDJSON stream: words as they come, then the finished reply. */
async function readReply(body: ReadableStream<Uint8Array>, onText: (soFar: string) => void): Promise<KachiReply> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let done: KachiReply | null = null;
  for (;;) {
    const { value, done: ended } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = ended ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { t: "d"; v: string } | ({ t: "done" } & KachiReply);
      if (event.t === "d") {
        raw += event.v;
        onText(visibleSoFar(raw));
      } else done = event;
    }
    if (ended) break;
  }
  return done ?? { reply: "I lost my train of thought there. Try again?", retry: true };
}

type Saved = { messages: ConversationMsg[]; threadId: string | null };

function readSaved(key: string | undefined): Saved | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function useKachiConversation(opts: {
  /** For analytics: which surface the chat is on. */
  where: "assistant" | "bubble";
  /** Where the customer is, sent with each message ("Chicken shawarma bowl (/recipes/…)"). */
  page?: () => string | null;
  /** Keep the conversation in this tab across pages (the bubble). */
  storageKey?: string;
}) {
  const router = useRouter();
  const cart = useCart();
  const [messages, setMessages] = useState<ConversationMsg[]>(() => readSaved(opts.storageKey)?.messages.filter((m) => !m.typing) ?? []);
  const [threadId, setThreadId] = useState<string | null>(() => readSaved(opts.storageKey)?.threadId ?? null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!opts.storageKey) return;
    try {
      sessionStorage.setItem(opts.storageKey, JSON.stringify({ messages: messages.filter((m) => !m.typing).slice(-30), threadId } satisfies Saved));
    } catch {}
  }, [messages, threadId, opts.storageKey]);

  const flash = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  const patchCard = (msgId: string, cardIdx: number, patch: Partial<CardState>) =>
    setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, cards: m.cards.map((c, i) => (i === cardIdx ? ({ ...c, ...patch } as CardState) : c)) } : m)));

  const afterChange = () => {
    void cart.refresh();
    router.refresh();
  };

  const callKachi = async (text: string, o: { replay?: boolean; replaceId?: string } = {}) => {
    const typingId = o.replaceId ?? newMsgId();
    setBusy(true);
    const typing: ConversationMsg = { id: typingId, role: "kachi", text: "", cards: [], typing: true };
    setMessages((ms) => (o.replaceId ? ms.map((m) => (m.id === typingId ? typing : m)) : [...ms, typing]));
    let data: KachiReply;
    const askedAt = clock();
    if (!o.replay) track("kachi_message_sent", { where: opts.where, length: text.length, firstInChat: messages.length === 0 });
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, threadId, replay: o.replay ?? false, page: opts.page?.() ?? undefined, stream: true }),
      });
      // Her words appear as she writes them; a refusal before she starts (busy, signed out) comes back as plain JSON.
      if (res.body && (res.headers.get("content-type") ?? "").includes("ndjson")) {
        data = await readReply(res.body, (soFar) => {
          if (soFar) setMessages((ms) => ms.map((m) => (m.id === typingId ? { ...m, typing: false, text: soFar } : m)));
        });
      } else {
        data = await res.json().catch(() => ({ reply: "I couldn't get that done just now. Try again in a moment.", retry: true }));
      }
    } catch {
      data = { reply: "I couldn't reach the server. Check your connection and try again.", retry: true };
    }
    const cards = (data.cards ?? []) as CardState[];
    const changed = cards.some((c) => c.type === "act" || (c.type === "account" && c.change.kind !== "report"));
    track("kachi_replied", { where: opts.where, ms: since(askedAt), ok: !data.retry, cards: cards.map((c) => c.type), changedBasket: changed });
    setMessages((ms) =>
      ms.map((m) =>
        m.id === typingId
          ? {
              id: typingId,
              role: "kachi",
              text: data.reply || data.error || "Sorry, I lost my train of thought. Try again?",
              cards,
              replies: data.suggestions?.length ? data.suggestions : changed ? AFTER_CHANGE_REPLIES : undefined,
              retry: data.retry ? text : undefined,
            }
          : m,
      ),
    );
    if (data.threadId) setThreadId(data.threadId);
    if (changed) afterChange();
    setBusy(false);
  };

  /** Sends a message; false if there was nothing to send or a reply is still coming. */
  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return false;
    setMessages((ms) => [...ms, { id: newMsgId(), role: "me", text, cards: [] }]);
    void callKachi(text);
    return true;
  };

  // The failed reply turns back into "typing"; the message is already stored, so it's a replay.
  const retry = (msgId: string, text: string) => {
    if (busy) return;
    void callKachi(text, { replay: true, replaceId: msgId });
  };

  const approve = async (msgId: string, cardIdx: number, card: Extract<CardState, { type: "list" }>) => {
    patchCard(msgId, cardIdx, { busy: true });
    const { card: actCard, error } = await approveKachiList(threadId, card.scope, card.items);
    if (!actCard) {
      patchCard(msgId, cardIdx, { busy: false });
      flash(error ?? "Couldn't add those. Try again.");
      return;
    }
    patchCard(msgId, cardIdx, { busy: false, done: `Added to ${scopeName(card.scope)}` });
    setMessages((ms) => [...ms, { id: newMsgId(), role: "kachi", text: "All in. Good choices.", cards: [actCard as CardState], replies: AFTER_CHANGE_REPLIES }]);
    afterChange();
  };

  /** Undo on any card that has one: basket changes, memories and account changes. */
  const undo = async (msgId: string, cardIdx: number, card: CardState) => {
    const run =
      card.type === "act"
        ? () => undoKachiChanges(card.scope, card.changes)
        : card.type === "memory"
          ? () => undoKachiMemory(card.action, card.memory)
          : card.type === "account"
            ? () => undoKachiAccount(card.change)
            : null;
    if (!run) return;
    patchCard(msgId, cardIdx, { busy: true });
    const { ok, error } = await run();
    patchCard(msgId, cardIdx, ok ? { busy: false, undone: true } : { busy: false });
    if (!ok) flash(error ?? "Couldn't undo that.");
    else if (card.type !== "memory") afterChange();
  };

  const skipList = (msgId: string, cardIdx: number) => patchCard(msgId, cardIdx, { done: "Skipped. Nothing was added." });

  const reset = () => {
    setMessages([]);
    setThreadId(null);
  };

  return { messages, setMessages, threadId, setThreadId, busy, toast, flash, send, retry, approve, undo, skipList, reset };
}
