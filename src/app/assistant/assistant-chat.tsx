"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { listMyThreads, loadMyThread, deleteMyThread } from "./thread-actions";

type Turn = { role: "user" | "assistant"; content: string };
type ThreadSummary = { id: string; title: string; source: string; contextRef: string | null; updatedAt: Date };

const OPENING: Turn = {
  role: "assistant",
  content:
    "Hi, I'm Kachi. Tell me what you'd like to change in your basket or cart — add something, adjust a quantity, switch baskets, check an order — and I'll do it.",
};

function groupThreads(threads: ThreadSummary[]) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const groups: { label: string; threads: ThreadSummary[] }[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Previous 7 days", threads: [] },
    { label: "Older", threads: [] },
  ];
  for (const t of threads) {
    const at = startOfDay(new Date(t.updatedAt));
    if (at === today) groups[0].threads.push(t);
    else if (at === yesterday) groups[1].threads.push(t);
    else if (at >= weekAgo) groups[2].threads.push(t);
    else groups[3].threads.push(t);
  }
  return groups.filter((g) => g.threads.length > 0);
}

export function AssistantChat() {
  const router = useRouter();
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([OPENING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const loadedFromQuery = useRef(false);

  const refreshThreadList = async () => {
    try {
      const rows = await listMyThreads();
      setThreads(rows as ThreadSummary[]);
    } catch {
      // History is a convenience, not core to sending a message — fail quietly.
    }
  };

  const openThread = async (id: string) => {
    setHistoryOpen(false);
    try {
      const thread = await loadMyThread(id);
      setThreadId(thread.id);
      setTurns(thread.messages.length ? thread.messages : [OPENING]);
    } catch {
      setTurns([OPENING]);
      setThreadId(null);
    }
  };

  useEffect(() => {
    if (loadedFromQuery.current) return;
    loadedFromQuery.current = true;
    const initial = params.get("thread");
    // One-time load of a thread handed off from a "Get ideas" sheet's
    // "Continue in Kachi" link (?thread=...), not a state sync loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) void openThread(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewChat = () => {
    setHistoryOpen(false);
    setThreadId(null);
    setTurns([OPENING]);
  };

  const removeThread = async (id: string) => {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    await deleteMyThread(id);
    if (id === threadId) startNewChat();
    await refreshThreadList();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setTurns((t) => [...t, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId }),
      });
      const data: { reply?: string; error?: string; threadId?: string } = await res.json().catch(() => ({}));
      const reply = data.reply ?? "I couldn't get that done just now. Try again in a moment.";
      setTurns((t) => [...t, { role: "assistant", content: reply }]);
      if (data.threadId && data.threadId !== threadId) setThreadId(data.threadId);
      // A basket/cart tool may have just mutated data another part of the
      // app already has cached (basket page, header item count, and so on).
      router.refresh();
      if (threads) void refreshThreadList();
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "I couldn't reach the server. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    const list = threads ?? [];
    const q = search.trim().toLowerCase();
    const matching = q ? list.filter((t) => t.title.toLowerCase().includes(q)) : list;
    return groupThreads(matching);
  }, [threads, search]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <div className="flex items-center gap-3 border-b border-border py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lavender text-carbon">
          <Icon name="assistant" size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Kachi</p>
          <p className="text-xs text-muted">Acts on your basket and cart, not general chat.</p>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          className="tap-target rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-sky-wash"
        >
          New chat
        </button>
        <button
          type="button"
          onClick={() => {
            setHistoryOpen(true);
            if (!threads) void refreshThreadList();
          }}
          aria-label="Chat history"
          className="tap-target rounded-full border border-border p-2 hover:bg-sky-wash"
        >
          <Icon name="preferences" size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Ordinary page content that scrolls with the rest of the page, rather
          than a viewport-height chat pane: this page sits below the full
          site header (logo, delivery bar, search, category nav), so trying
          to size this to the viewport itself was overshooting the space
          actually left and pushing the input off-screen. The input below is
          fixed instead, the same pattern as the basket page's checkout bar. */}
      <div className="space-y-3 py-4">
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
        {loading && <p className="text-sm text-muted">Kachi is thinking…</p>}
      </div>

      <form
        onSubmit={send}
        className="fixed inset-x-0 z-30 border-t border-border bg-surface px-4 py-3"
        style={{ bottom: "var(--mobile-nav-h)" }}
      >
        <div className="mx-auto flex max-w-2xl gap-2">
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
        </div>
      </form>

      {historyOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close history"
            onClick={() => setHistoryOpen(false)}
            className="absolute inset-0 bg-carbon/40"
          />
          <div className="relative flex h-full w-full max-w-sm flex-col bg-surface p-4 shadow-xl sm:max-w-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Chat history</p>
              <button type="button" onClick={() => setHistoryOpen(false)} className="tap-target rounded-full p-2 hover:bg-sky-wash">
                <Icon name="close" size={16} />
              </button>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="mt-3 w-full rounded-full border border-border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={startNewChat}
              className="mt-3 rounded-card border border-dashed border-border px-3 py-2 text-left text-sm font-medium hover:bg-sky-wash"
            >
              + New chat
            </button>
            <div className="mt-3 flex-1 space-y-4 overflow-y-auto">
              {threads === null && <p className="text-sm text-muted">Loading…</p>}
              {threads !== null && filteredGroups.length === 0 && (
                <p className="text-sm text-muted">No chats yet.</p>
              )}
              {filteredGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                  <div className="space-y-1">
                    {group.threads.map((t) => (
                      <div
                        key={t.id}
                        className={`group flex items-center gap-1 rounded-card px-2 py-2 hover:bg-sky-wash ${
                          t.id === threadId ? "bg-sky-wash" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openThread(t.id)}
                          className="min-w-0 flex-1 truncate text-left text-sm"
                        >
                          {t.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeThread(t.id)}
                          aria-label="Delete chat"
                          className="shrink-0 rounded-full p-1.5 text-muted opacity-0 hover:bg-white group-hover:opacity-100"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
