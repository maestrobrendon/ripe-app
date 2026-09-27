"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type Turn = { role: "user" | "assistant"; content: string };

const OPENING: Turn = {
  role: "assistant",
  content:
    "Hi, I'm Basket's assistant. Tell me what you'd like to change in your basket or cart — add something, adjust a quantity, switch baskets, check an order — and I'll do it.",
};

export function AssistantChat() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([OPENING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const history = turns.slice(-20);
    setTurns((t) => [...t, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data: { reply?: string; error?: string } = await res.json().catch(() => ({}));
      const reply = data.reply ?? "I couldn't get that done just now. Try again in a moment.";
      setTurns((t) => [...t, { role: "assistant", content: reply }]);
      // A basket/cart tool may have just mutated data another part of the
      // app already has cached (basket page, header item count, and so on).
      router.refresh();
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "I couldn't reach the server. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100svh-var(--mobile-nav-h))] max-w-2xl flex-col px-4 sm:h-[calc(100svh-1px)] sm:px-6">
      <div className="flex items-center gap-3 border-b border-border py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lavender text-carbon">
          <Icon name="assistant" size={18} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-semibold">Assistant</p>
          <p className="text-xs text-muted">Acts on your basket and cart, not general chat.</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {turns.map((turn, i) => (
          <div
            key={i}
            className={
              turn.role === "user"
                ? "ml-auto max-w-[85%] rounded-card bg-carbon px-4 py-2.5 text-sm text-white"
                : "max-w-[85%] rounded-card border border-border bg-sky-wash/60 px-4 py-2.5 text-sm text-carbon"
            }
          >
            {turn.content}
          </div>
        ))}
        {loading && <p className="text-sm text-muted">Thinking…</p>}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add 3 bananas to my Tuesday basket"
          className="min-w-0 flex-1 rounded-full border border-border px-4 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="tap-target shrink-0 rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
