"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { KachiMark } from "@/components/kachi-mark";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { CUSTOMER_STEPS, customerStatusLabel, customerStep } from "@/lib/order-status";
import { press, spring } from "@/lib/motion/tokens";
import type { KachiCard, KachiMode, KachiReply, KachiScope } from "@/lib/kachi-types";
import { listMyThreads, loadMyThread, deleteMyThread, approveKachiList, undoKachiChanges } from "./thread-actions";

type BasketOption = { id: string; name: string };
type CardState = KachiCard & { undone?: boolean; done?: string; busy?: boolean; stale?: boolean };
type Msg = {
  id: string;
  role: "me" | "kachi";
  text: string;
  cards: CardState[];
  typing?: boolean;
  replies?: string[];
  /** The message to send again when this reply was a failure. */
  retry?: string;
};
type ThreadSummary = { id: string; title: string; updatedAt: Date; messageCount: number };

const STARTERS = {
  chat: [
    ["🍲", "What can I cook with my basket?"],
    ["💪", "What should I eat after the gym?"],
    ["🥗", "A light dinner for tonight"],
    ["🥬", "How do I keep ugu fresh?"],
  ],
  act: [
    ["🍌", "Add 3 bananas"],
    ["🧺", "Fill my basket for a gym week"],
    ["🍲", "What can I cook with my basket?"],
    ["🚚", "Where is my order?"],
  ],
} as const;

/** Each starter gets its own sticker colour, so the first screen feels like a kitchen, not a form. */
const STARTER_TINTS = ["bg-mint-pop/35", "bg-sunburst/45", "bg-lavender", "bg-[#d1eafd]"];

/** A line for the time of day; null on the server so the first render matches. */
function timeGreeting(hour: number | null) {
  if (hour === null) return "What are we cooking?";
  if (hour < 5) return "Up late? Let's find you something good.";
  if (hour < 12) return "Good morning. Breakfast, or planning ahead?";
  if (hour < 17) return "Good afternoon. Thinking about dinner already?";
  return "Good evening. Something light, or something to share?";
}
const noSubscribe = () => () => {};

const AFTER_CHANGE_REPLIES = ["What can I cook with this?", "Check my order"];

let seq = 0;
const newId = () => `m${Date.now()}-${seq++}`;

function titleFrom(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 34 ? `${clean.slice(0, 32)}…` : clean;
}

/** **bold** and line breaks from Kachi's plain-text replies, nothing else. */
function RichText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-base leading-relaxed">
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
      )}
    </p>
  );
}

function groupThreads(threads: ThreadSummary[]) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date());
  const yesterday = today - 86_400_000;
  const groups: { label: string; threads: ThreadSummary[] }[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Earlier", threads: [] },
  ];
  for (const t of threads) {
    const at = startOfDay(new Date(t.updatedAt));
    groups[at === today ? 0 : at === yesterday ? 1 : 2].threads.push(t);
  }
  return groups.filter((g) => g.threads.length > 0);
}

export function KachiChat({ firstName, baskets }: { firstName: string; baskets: BasketOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const cart = useCart();

  // Opens in "Just chatting" every time: nothing changes until the customer picks a destination.
  const [mode, setMode] = useState<KachiMode>({ kind: "chat" });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState("Kachi");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [whereOpen, setWhereOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const loadedFromQuery = useRef(false);

  const acting = mode.kind !== "chat";
  const basketName = (id: string) => baskets.find((b) => b.id === id)?.name ?? "Your basket";
  const modeLabel = mode.kind === "cart" ? "Cart" : mode.kind === "basket" ? basketName(mode.basketId) : "Just chatting";
  const modeWhere = mode.kind === "cart" ? "your cart" : mode.kind === "basket" ? basketName(mode.basketId) : "";
  const scopeName = (s: KachiScope) => (s.kind === "cart" ? "your cart" : s.name);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const flash = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  const patchCard = (msgId: string, cardIdx: number, patch: Partial<CardState>) =>
    setMessages((ms) =>
      ms.map((m) =>
        m.id === msgId ? { ...m, cards: m.cards.map((c, i) => (i === cardIdx ? ({ ...c, ...patch } as CardState) : c)) } : m,
      ),
    );

  const afterChange = () => {
    void cart.refresh();
    router.refresh();
  };

  const callKachi = async (text: string, opts: { replay?: boolean; mode?: KachiMode; replaceId?: string } = {}) => {
    const typingId = opts.replaceId ?? newId();
    setBusy(true);
    const typing: Msg = { id: typingId, role: "kachi", text: "", cards: [], typing: true };
    setMessages((ms) => (opts.replaceId ? ms.map((m) => (m.id === typingId ? typing : m)) : [...ms, typing]));
    let data: KachiReply;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, threadId, mode: opts.mode ?? mode, replay: opts.replay ?? false }),
      });
      data = await res.json().catch(() => ({ reply: "I couldn't get that done just now. Try again in a moment.", retry: true }));
    } catch {
      data = { reply: "I couldn't reach the server. Check your connection and try again.", retry: true };
    }
    const cards = (data.cards ?? []) as CardState[];
    const changed = cards.some((c) => c.type === "act");
    setMessages((ms) =>
      ms.map((m) =>
        m.id === typingId
          ? {
              id: typingId,
              role: "kachi",
              text: data.reply || data.error || "Sorry, I lost my train of thought. Try again?",
              cards,
              replies: changed ? AFTER_CHANGE_REPLIES : undefined,
              retry: data.retry ? text : undefined,
            }
          : m,
      ),
    );
    if (data.threadId) setThreadId(data.threadId);
    if (changed) afterChange();
    setBusy(false);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    if (messages.length === 0) setTitle(titleFrom(text));
    setMessages((ms) => [...ms, { id: newId(), role: "me", text, cards: [] }]);
    setInput("");
    void callKachi(text);
  };

  // The failed reply turns back into "typing"; the message is already stored, so it's a replay.
  const retry = (msgId: string, text: string) => {
    if (busy) return;
    void callKachi(text, { replay: true, replaceId: msgId });
  };

  const pickDestination =(msgId: string, cardIdx: number, request: string, target: KachiMode, name: string) => {
    patchCard(msgId, cardIdx, { done: `Switched to ${name}.` });
    setMode(target);
    void callKachi(request, { replay: true, mode: target });
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
    setMessages((ms) => [
      ...ms,
      { id: newId(), role: "kachi", text: "All in.", cards: [actCard as CardState], replies: AFTER_CHANGE_REPLIES },
    ]);
    afterChange();
  };

  const undo = async (msgId: string, cardIdx: number, card: Extract<CardState, { type: "act" }>) => {
    patchCard(msgId, cardIdx, { busy: true });
    const { ok, error } = await undoKachiChanges(card.scope, card.changes);
    patchCard(msgId, cardIdx, ok ? { busy: false, undone: true } : { busy: false });
    if (ok) afterChange();
    else flash(error ?? "Couldn't undo that.");
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text.replace(/\*\*/g, ""));
    flash("Copied");
  };

  const newChat = () => {
    setMessages([]);
    setThreadId(null);
    setTitle("Kachi");
    setHistoryOpen(false);
  };

  const refreshThreads = async () => {
    try {
      setThreads((await listMyThreads()) as ThreadSummary[]);
    } catch {
      setThreads([]);
    }
  };

  const openThread = async (id: string) => {
    setHistoryOpen(false);
    try {
      const t = await loadMyThread(id);
      setThreadId(t.id);
      setTitle(t.title);
      setMessages(
        t.messages.map((m) => ({
          id: newId(),
          role: m.role === "user" ? "me" : "kachi",
          text: m.content,
          // Cards from an earlier session are a record, not live controls.
          cards: m.cards.map((c) => ({ ...c, stale: true }) as CardState),
        })),
      );
    } catch {
      newChat();
    }
  };

  const removeThread = async (id: string) => {
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    await deleteMyThread(id);
    if (id === threadId) newChat();
    await refreshThreads();
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

  const lastKachiIdx = messages.map((m) => m.role).lastIndexOf("kachi");
  const hour = useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => null);
  const starters = acting ? STARTERS.act : STARTERS.chat;

  return (
    // Fills the screen under the 69px signed-in header (no search here) and
    // above the dock, so the thread scrolls inside and the composer stays put.
    <div>
      <div className="mx-auto flex h-[calc(100svh-69px-var(--dock-clearance))] max-w-2xl flex-col lg:h-[calc(100svh-69px)]">
        {/* Chat bar */}
        <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            onClick={() => {
              setHistoryOpen(true);
              void refreshThreads();
            }}
            aria-label="Past chats"
            className="tap-target flex h-11 w-11 items-center justify-center rounded-full active:bg-soft-mist"
          >
            <Icon name="history" size={22} />
          </button>
          <span className="flex-1 truncate text-center text-[17px] font-semibold">
            {messages.length ? title : "Kachi"}
          </span>
          <button
            onClick={newChat}
            aria-label="New chat"
            className="tap-target flex h-11 w-11 items-center justify-center rounded-full active:bg-soft-mist"
          >
            <Icon name="newChat" size={22} />
          </button>
        </div>

        {/* Thread */}
        <main ref={threadRef} aria-live="polite" className="flex-1 overflow-y-auto px-5 pb-4 pt-5">
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-3 text-center">
              <div className="relative w-full overflow-hidden rounded-[28px] bg-[#d1eafd] px-5 pt-6 pb-5">
                {/* Confetti of colour behind her: she's warm, not a form. */}
                <span aria-hidden className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-sunburst/70" />
                <span aria-hidden className="absolute -right-5 -bottom-8 h-24 w-24 rounded-full bg-lavender" />
                <span aria-hidden className="absolute top-5 right-8 h-3 w-3 rounded-full bg-ember" />
                <div className="relative flex flex-col items-center">
                  <motion.span
                    animate={{ rotate: [0, -10, 8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }}
                    className="rounded-full bg-paper-white p-1.5 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.4)]"
                  >
                    <KachiMark className="h-14 w-14" />
                  </motion.span>
                  <h1 className="mt-3 text-[30px] leading-tight font-extrabold tracking-tight">
                    Hi {firstName} <span aria-hidden>👋</span>
                  </h1>
                  <p className="mt-1 max-w-75 text-[15px] leading-snug text-carbon/75">
                    {acting ? `Tell me what you need and I'll add, swap or plan it in ${modeWhere}.` : timeGreeting(hour)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
                {starters.map(([emoji, text], i) => (
                  <motion.button
                    key={`${mode.kind}-${text}`}
                    onClick={() => send(text)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.snappy, delay: i * 0.04 }}
                    whileTap={{ scale: press.scale }}
                    className={`flex min-h-26 flex-col gap-2.5 rounded-[22px] p-3.5 text-left transition-[filter] hover:brightness-[0.97] active:brightness-95 ${STARTER_TINTS[i % STARTER_TINTS.length]}`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-paper-white text-[22px] shadow-[0_6px_14px_-8px_rgb(0_0_0/0.35)]" aria-hidden>
                      {emoji}
                    </span>
                    <b className="text-[15px] font-semibold leading-snug">{text}</b>
                  </motion.button>
                ))}
              </div>
              <p className="mt-4 flex justify-center gap-2 text-[13px] leading-snug text-muted">
                <Icon name="shield" size={16} className="mt-px shrink-0 text-carbon" />
                <span>
                  {acting
                    ? "You see every change I make, and you can undo it."
                    : "While we chat, nothing in your basket or cart changes."}
                </span>
              </p>
            </div>
          ) : (
            messages.map((m, mi) =>
              m.role === "me" ? (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.snappy}
                  className="mb-4.5 flex justify-end"
                >
                  <p className="max-w-[82%] rounded-[20px_20px_6px_20px] bg-carbon px-4 py-3 text-base leading-snug text-white">
                    {m.text}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.snappy}
                  className="mb-4.5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <KachiMark className="h-7 w-7" />
                    <b className="text-[15px] font-semibold">Kachi</b>
                  </div>

                  {m.typing ? (
                    <div className="flex gap-1 py-2.5" aria-label="Kachi is typing">
                      {[0, 1, 2].map((d) => (
                        <motion.i
                          key={d}
                          className={`block h-2 w-2 rounded-full ${["bg-mint-pop", "bg-sunburst", "bg-lavender"][d]}`}
                          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                        />
                      ))}
                    </div>
                  ) : m.retry ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="text-base leading-relaxed text-muted">{m.text}</p>
                      {mi === messages.length - 1 && (
                        <motion.button
                          whileTap={{ scale: press.scale }}
                          disabled={busy}
                          onClick={() => retry(m.id, m.retry!)}
                          className="inline-flex h-9.5 items-center gap-1.5 rounded-full bg-carbon px-4 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <Icon name="recurring" size={15} weight="bold" />
                          Try again
                        </motion.button>
                      )}
                    </div>
                  ) : (
                    <>
                      <RichText text={m.text} />
                      <div className="mt-1 flex gap-1">
                        <button
                          onClick={() => copy(m.text)}
                          aria-label="Copy"
                          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted active:bg-soft-mist"
                        >
                          <Icon name="copy" size={16} />
                        </button>
                      </div>
                    </>
                  )}

                  {m.cards.map((c, ci) => (
                    <KachiCardView
                      key={ci}
                      card={c}
                      baskets={baskets}
                      scopeName={scopeName}
                      onUndo={() => c.type === "act" && undo(m.id, ci, c)}
                      onApprove={() => c.type === "list" && approve(m.id, ci, c)}
                      onSkip={() => patchCard(m.id, ci, { done: "Skipped. Nothing was added." })}
                      onPick={(target, name) => c.type === "ask" && pickDestination(m.id, ci, c.request, target, name)}
                      onSend={(text) => send(text)}
                    />
                  ))}

                  {m.replies && mi === lastKachiIdx && mi === messages.length - 1 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {m.replies.map((r) => (
                        <button
                          key={r}
                          onClick={() => send(r)}
                          className="h-9.5 rounded-full bg-lavender/70 px-3.5 text-sm font-medium transition-colors hover:bg-lavender active:bg-lavender"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ),
            )
          )}
        </main>

        {/* Composer */}
        <div className="flex-none border-t border-border bg-surface px-3 pb-3 pt-2.5">
          <motion.button
            layout
            onClick={() => setWhereOpen(true)}
            whileTap={{ scale: press.scale }}
            transition={spring.snappy}
            className={`mb-2 ml-1 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] ${acting ? "bg-mint-pop/45" : "bg-lavender"}`}
          >
            <span className={`h-2 w-2 rounded-full ${acting ? "bg-[#0f7a48]" : "bg-voltage-violet"}`} />
            {acting ? (
              <span>
                Working on <b className="font-semibold">{modeLabel}</b>
              </span>
            ) : (
              <b className="font-semibold">Just chatting</b>
            )}
            <Icon name="caretDown" size={13} weight="bold" />
          </motion.button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            autoComplete="off"
            className="flex min-h-13 items-center gap-2 rounded-full bg-soft-mist py-1 pr-1 pl-4.5 shadow-[inset_0_0_0_1.5px_transparent] transition-shadow focus-within:bg-paper-white focus-within:shadow-[inset_0_0_0_1.5px_var(--color-carbon)]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={acting ? `Add, swap or plan for ${modeWhere}` : "Ask Kachi about food or your basket"}
              aria-label="Message Kachi"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            <motion.button
              type="submit"
              aria-label="Send"
              disabled={busy || !input.trim()}
              whileTap={{ scale: press.scale }}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-mint-pop text-carbon transition-colors disabled:bg-carbon/10 disabled:text-carbon/35"
            >
              <Icon name="arrowUp" size={20} weight="bold" />
            </motion.button>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 8, x: "-50%" }}
            transition={spring.snappy}
            className="fixed bottom-[calc(var(--dock-clearance)+9rem)] left-1/2 z-(--z-overlay) rounded-xl bg-carbon px-4 py-2.5 text-sm text-white lg:bottom-40"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet open={whereOpen} onClose={() => setWhereOpen(false)} title="How should Kachi help?">
        <p className="mb-3.5 text-[15px] text-muted">You can switch at any time.</p>
        <ModeOption
          icon="assistant"
          title="Just chat"
          sub="Ask about food and your basket. Nothing changes."
          selected={mode.kind === "chat"}
          onClick={() => {
            setMode({ kind: "chat" });
            setWhereOpen(false);
          }}
        />
        <p className="mb-1.5 mt-4 text-[13px] font-semibold text-muted">Let Kachi make changes in</p>
        {baskets.map((b) => (
          <ModeOption
            key={b.id}
            icon="cart"
            title={b.name}
            sub="Your basket"
            selected={mode.kind === "basket" && mode.basketId === b.id}
            onClick={() => {
              setMode({ kind: "basket", basketId: b.id });
              setWhereOpen(false);
            }}
          />
        ))}
        <ModeOption
          icon="trolley"
          title="Cart"
          sub="Buy once"
          selected={mode.kind === "cart"}
          onClick={() => {
            setMode({ kind: "cart" });
            setWhereOpen(false);
          }}
        />
      </BottomSheet>

      <BottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Past chats">
        <p className="mb-2 text-[15px] text-muted">Pick up where you left off.</p>
        {threads === null ? (
          <p className="py-4 text-sm text-muted">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="py-4 text-[15px] text-muted">No past chats yet.</p>
        ) : (
          groupThreads(threads).map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 mt-4 text-[13px] font-semibold text-muted">{g.label}</p>
              {g.threads.map((t) => (
                <div key={t.id} className="flex items-center gap-2 border-b border-border">
                  <button onClick={() => openThread(t.id)} className="min-w-0 flex-1 py-3.5 text-left text-base">
                    <span className="block truncate">{t.title}</span>
                    <small className="mt-0.5 block text-[13px] text-muted">{t.messageCount} messages</small>
                  </button>
                  <button
                    onClick={() => removeThread(t.id)}
                    aria-label={`Delete ${t.title}`}
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted active:bg-soft-mist"
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </BottomSheet>
    </div>
  );
}

function ModeOption({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: "assistant" | "cart" | "trolley";
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-checked={selected}
      role="radio"
      className={`mb-2.5 flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${
        selected ? "border-carbon" : "border-border"
      }`}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-soft-mist">
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{title}</b>
        <small className="mt-0.5 block text-sm text-muted">{sub}</small>
      </span>
      {selected && <Icon name="checkPlain" size={20} weight="bold" className="flex-none" />}
    </button>
  );
}

function KachiCardView({
  card,
  baskets,
  scopeName,
  onUndo,
  onApprove,
  onSkip,
  onPick,
  onSend,
}: {
  card: CardState;
  baskets: BasketOption[];
  scopeName: (s: KachiScope) => string;
  onUndo: () => void;
  onApprove: () => void;
  onSkip: () => void;
  onPick: (target: KachiMode, name: string) => void;
  onSend: (text: string) => void;
}) {
  const shell = "mt-2.5 overflow-hidden rounded-2xl border border-border";

  if (card.type === "recipes") {
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        {card.recipes.map((r, idx) => (
          <div key={r.slug} className={`px-3.5 py-3 ${idx ? "border-t border-border" : ""}`}>
            <Link href={`/recipes/${r.slug}`} className="group flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-soft-mist">
                <Icon name="recipes" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold leading-snug group-hover:underline">{r.title}</b>
                <small className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{r.summary}</small>
              </span>
              <Icon name="caretRight" size={16} className="mt-3 flex-none text-muted" />
            </Link>
            {!card.stale && r.fromBasket > 0 && (
              <button
                onClick={() => onSend(`Add the ingredients for ${r.title}`)}
                className="ml-13 mt-2 inline-flex h-8.5 items-center gap-1.5 rounded-full bg-soft-mist px-3 text-[13px] font-semibold active:bg-border"
              >
                <Icon name="plus" size={14} weight="bold" />
                Add the {r.fromBasket} ingredients
              </button>
            )}
          </div>
        ))}
      </motion.div>
    );
  }

  if (card.type === "act") {
    const where = scopeName(card.scope);
    const n = card.changes.length;
    const one = card.changes[0];
    let text: React.ReactNode;
    if (n === 1 && one.after > one.before) {
      text = <>Added <b className="font-semibold">{one.after - one.before} {one.name.toLowerCase()}</b> to {where}.</>;
    } else if (n === 1 && one.after === 0) {
      text = <>Removed <b className="font-semibold">{one.name.toLowerCase()}</b> from {where}.</>;
    } else if (n === 1) {
      text = <>Changed <b className="font-semibold">{one.name.toLowerCase()}</b> to {one.after} in {where}.</>;
    } else if (card.changes.every((c) => c.after > c.before)) {
      text = <>Added <b className="font-semibold">{n} things</b> to {where}.</>;
    } else if (card.changes.every((c) => c.after === 0)) {
      text = <>Removed <b className="font-semibold">{n} things</b> from {where}.</>;
    } else {
      text = <>Changed <b className="font-semibold">{n} things</b> in {where}.</>;
    }
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        <div className={`flex items-center gap-3 px-3.5 py-3 transition-opacity ${card.undone ? "opacity-50" : ""}`}>
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
              card.undone ? "bg-soft-mist text-muted" : "bg-mint-pop/30 text-carbon"
            }`}
          >
            <Icon name="checkPlain" size={16} weight="bold" />
          </span>
          <span className="flex-1 text-[15px] leading-snug">
            {card.undone && "Undone. "}
            {text}
          </span>
          {!card.undone && !card.stale && (
            <button disabled={card.busy} onClick={onUndo} className="p-1.5 text-sm font-semibold text-carbon underline-offset-2 hover:underline disabled:opacity-50">
              Undo
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  if (card.type === "list") {
    const total = card.items.reduce((t, i) => t + i.unitPrice * i.quantity, 0);
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        {card.items.map((i, idx) => (
          <div key={i.productId} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx ? "border-t border-border" : ""}`}>
            <ProductImage
              publicId={i.cloudinaryPublicId}
              alt={i.name}
              emoji={i.imageEmoji}
              className="h-10 w-10 flex-none"
              rounded="rounded-[10px]"
              flavour="bg-soft-mist"
              emojiClassName="text-[22px]"
              sizes="40px"
            />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-semibold">{i.name}</b>
              <small className="text-[13px] text-muted">
                {i.quantity} x {i.unit}
              </small>
            </span>
            <span className="text-sm font-semibold">{formatNaira(i.unitPrice * i.quantity)}</span>
          </div>
        ))}
        <div className="flex gap-2 bg-soft-mist px-3.5 py-3">
          {card.done ? (
            <span className="py-3 text-sm font-semibold text-carbon">{card.done}</span>
          ) : card.stale ? (
            <span className="py-3 text-sm text-muted">Suggested list</span>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: press.scale }}
                disabled={card.busy}
                onClick={onApprove}
                className="h-11 flex-1 rounded-full bg-carbon text-[15px] font-semibold text-white disabled:opacity-50"
              >
                Add all, {formatNaira(total)}
              </motion.button>
              <motion.button
                whileTap={{ scale: press.scale }}
                disabled={card.busy}
                onClick={onSkip}
                className="h-11 flex-1 rounded-full bg-surface text-[15px] font-semibold disabled:opacity-50"
              >
                Not now
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  if (card.type === "ask") {
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        <div className="flex flex-wrap gap-2 px-3.5 py-3">
          {card.done || card.stale ? (
            <span className="py-3 text-sm text-muted">{card.done ?? "Picked a destination."}</span>
          ) : (
            <>
              {baskets.map((b) => (
                <motion.button
                  key={b.id}
                  whileTap={{ scale: press.scale }}
                  onClick={() => onPick({ kind: "basket", basketId: b.id }, b.name)}
                  className="h-11 min-w-[40%] flex-1 rounded-full bg-carbon px-4 text-[15px] font-semibold text-white"
                >
                  {b.name}
                </motion.button>
              ))}
              <motion.button
                whileTap={{ scale: press.scale }}
                onClick={() => onPick({ kind: "cart" }, "Cart")}
                className="h-11 min-w-[40%] flex-1 rounded-full bg-soft-mist px-4 text-[15px] font-semibold"
              >
                Cart
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  const step = customerStep(card.order.status) ?? -1;
  const day = new Date(card.order.deliveryDate).toLocaleDateString("en-GB", { weekday: "long" });
  return (
    <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
      <div className="p-3.5">
        <h4 className="text-[15px] font-semibold">
          {card.order.status === "DELIVERED" ? `Delivered ${day}` : step < 0 || card.order.status === "FAILED_DELIVERY" ? customerStatusLabel(card.order.status) : `Arriving ${day}`}
        </h4>
        <small className="text-[13px] text-muted">Order #{card.order.id.slice(-8).toUpperCase()}</small>
        <div className="mt-3 flex gap-1.5">
          {CUSTOMER_STEPS.map((s, i) => (
            <motion.i
              key={s}
              className={`block h-1.5 flex-1 rounded-full ${i <= step ? "bg-carbon" : "bg-soft-mist"}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ originX: 0 }}
              transition={{ ...spring.smooth, delay: i * 0.06 }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          {CUSTOMER_STEPS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
