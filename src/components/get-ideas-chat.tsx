"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const PROMOTE_AFTER_USER_MESSAGES = 4;

/**
 * The "Get ideas" sheet's real Kachi conversation (Basket vs. Cart addendum,
 * Section 3) — a compact chat, tagged with where it started, that writes to
 * the same persisted thread the full Assistant tab reads from. Sits alongside
 * (not instead of) a surface's curated suggestion content.
 */
export function GetIdeasChat({
  source,
  contextRef,
  starters,
}: {
  source: "BASKET_SHEET" | "CART_SHEET" | "MEAL_PLANNER" | "PRODUCE_PLANNER";
  contextRef?: string;
  starters: string[];
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userMessageCount, setUserMessageCount] = useState(0);

  const sendMessage = async (message: string) => {
    if (!message || loading) return;
    setTurns((t) => [...t, { role: "user", content: message }]);
    setUserMessageCount((n) => n + 1);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId, source, contextRef }),
      });
      const data: { reply?: string; threadId?: string } = await res.json().catch(() => ({}));
      setTurns((t) => [...t, { role: "assistant", content: data.reply ?? "I couldn't get that done just now." }]);
      if (data.threadId) setThreadId(data.threadId);
      router.refresh();
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "I couldn't reach the server. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const showPromote = threadId && userMessageCount >= PROMOTE_AFTER_USER_MESSAGES;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ask Kachi</p>

      {turns.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {starters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendMessage(s)}
              className="rounded-full border border-border bg-sky-wash px-3 py-1.5 text-left text-xs font-medium hover:bg-lavender"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="mb-3 space-y-2">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === "user"
                  ? "ml-auto max-w-[85%] rounded-card bg-carbon px-3 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-card border border-border bg-sky-wash/60 px-3 py-2 text-sm text-carbon"
              }
            >
              {turn.content}
            </div>
          ))}
          {loading && <p className="text-sm text-muted">Kachi is thinking…</p>}
        </div>
      )}

      {showPromote ? (
        <Link
          href={`/assistant?thread=${threadId}`}
          className="block rounded-full bg-carbon px-4 py-2.5 text-center text-sm font-semibold text-white"
        >
          Continue in Kachi
        </Link>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Kachi anything about this"
            className="min-w-0 flex-1 rounded-full border border-border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="tap-target shrink-0 rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
      {threadId && !showPromote && (
        <Link href={`/assistant?thread=${threadId}`} className="mt-2 block text-center text-xs text-muted underline">
          Continue in Kachi
        </Link>
      )}
    </div>
  );
}
