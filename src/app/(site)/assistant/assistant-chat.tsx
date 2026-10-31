"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { KachiMark } from "@/components/kachi-mark";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";

import { haptic, press, spring } from "@/lib/motion/tokens";
import { KachiCardView, RichText, type CardState } from "@/components/kachi/kachi-cards";
import { newMsgId, scopeName, useKachiConversation } from "@/components/kachi/use-kachi-conversation";
import { ComposerTools, PhotoPreview } from "@/components/kachi/composer-tools";
import { listMyThreads, loadMyThread, deleteMyThread } from "./thread-actions";

type ThreadSummary = { id: string; title: string; updatedAt: Date; messageCount: number };

/** Things to ask, in two rows that scroll. */
const PROMPTS: [string, string][][] = [
  [
    ["🥭", "What's good this week?"],
    ["🥗", "Something fresh for lunch"],
    ["🚚", "Where's my basket?"],
  ],
  [
    ["🍍", "Plan my fruit for the week"],
    ["🧒", "Something the kids will eat"],
    ["🥬", "Swap the cabbage for something else"],
  ],
];

/** The big question, two lines, for the time of day; the server has no hour, so it asks the plain one. */
function headline(hour: number | null): [string, string] {
  if (hour === null) return ["What are we", "eating today?"];
  if (hour < 5) return ["Up late? Let's", "find a snack."];
  if (hour < 12) return ["Morning. What's", "for breakfast?"];
  if (hour < 17) return ["Afternoon. What", "are we eating?"];
  return ["Evening. Light,", "or to share?"];
}
const noSubscribe = () => () => {};

/** One of the two big things Kachi does, as a card you tap to start. */
function FeatureCard({ tint, icon, title, body, delay, onClick }: { tint: string; icon: "recipes" | "season"; title: string; body: string; delay: number; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay }}
      whileTap={{ scale: press.scale }}
      className={`flex min-h-44 flex-col rounded-[24px] p-4 text-left ${tint}`}
    >
      <span className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-paper-white">
          <Icon name={icon} size={18} />
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-carbon/15">
          <Icon name="arrowUp" size={12} weight="bold" className="rotate-45" />
        </span>
      </span>
      <b className="mt-auto block text-[17px] leading-snug font-semibold">{title}</b>
      <small className="mt-1 block text-[13px] leading-snug text-carbon/65">{body}</small>
    </motion.button>
  );
}



function titleFrom(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 34 ? `${clean.slice(0, 32)}…` : clean;
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

export function KachiChat({ firstName, deliveryLabel }: { firstName: string; deliveryLabel: string }) {
  const params = useSearchParams();

  const kachi = useKachiConversation({ where: "assistant" });
  const { messages, setMessages, threadId, setThreadId, busy, toast, flash, retry, approve, undo, skipList } = kachi;
  const [title, setTitle] = useState("Kachi");
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const loadedFromQuery = useRef(false);

  useEffect(() => {
    const el = threadRef.current;
    // Follow the newest message; the empty screen starts at its top.
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // A photo waiting to go with the next message.
  const [photo, setPhoto] = useState<string | null>(null);
  const send = (raw: string) => {
    if (messages.length === 0 && (raw.trim() || photo)) setTitle(titleFrom(raw.trim() || "A photo"));
    if (kachi.send(raw, photo ?? undefined)) {
      setInput("");
      setPhoto(null);
    }
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
          id: newMsgId(),
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

  return (
    // On phones the chat is pinned to the screen: from the top edge (the site
    // header stays off this screen) down to just above the dock, so the page
    // has nothing to scroll, the thread scrolls inside, and the composer can
    // never slide under the menu. Desktop sits under its header as a column.
    <div>
      <div className="fixed inset-x-0 top-0 bottom-[calc(var(--dock-height)+var(--dock-inset)+0.75rem)] flex flex-col lg:static lg:mx-auto lg:h-[calc(100svh-69px)] lg:max-w-2xl">
        {/* Chat bar */}
        <div className="flex flex-none items-center gap-2 border-b border-hairline px-3 py-2.5">
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
            <div className="flex flex-col py-2">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={spring.juicy}>
                <KachiMark className="h-12 w-12" />
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: 0.1 }} className="mt-5 text-[15px] text-muted">
                Hi {firstName} <span aria-hidden>👋</span>
              </motion.p>
              {/* The question arrives a word at a time, each one coming into focus. */}
              <h1 className="mt-1.5 text-[32px] leading-[1.12] font-semibold tracking-[-0.03em]" aria-label={headline(hour).join(" ")}>
                {headline(hour).map((line, li) => (
                  <span key={line} className="block" aria-hidden>
                    {line.split(" ").map((word, wi) => (
                      <motion.span
                        key={`${li}-${wi}`}
                        initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ ...spring.smooth, delay: 0.15 + (li * 3 + wi) * 0.06 }}
                        className="inline-block"
                      >
                        {word}&nbsp;
                      </motion.span>
                    ))}
                  </span>
                ))}
              </h1>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <FeatureCard
                  tint="bg-mint-pop/35"
                  icon="recipes"
                  title="Plan my week"
                  body={`Recipes from what's in ${deliveryLabel}.`}
                  delay={0.45}
                  onClick={() => {
                    haptic(6);
                    send("Plan my week from my basket");
                  }}
                />
                <FeatureCard
                  tint="bg-sunburst/40"
                  icon="season"
                  title="What's good now"
                  body="In season, and worth adding."
                  delay={0.52}
                  onClick={() => {
                    haptic(6);
                    send("What's good this week?");
                  }}
                />
              </div>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} className="mt-6 text-[15px] font-semibold">
                Try asking
              </motion.p>
              <div className="mt-2.5 flex flex-col gap-2">
                {PROMPTS.map((row, ri) => (
                  <div key={ri} className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
                    {row.map(([emoji, text], i) => (
                      <motion.button
                        key={text}
                        type="button"
                        onClick={() => {
                          haptic(6);
                          send(text);
                        }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring.snappy, delay: 0.7 + (ri * 3 + i) * 0.05 }}
                        whileTap={{ scale: press.scale }}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-soft-mist px-3.5 text-[14px] font-medium"
                      >
                        <span aria-hidden>{emoji}</span>
                        {text}
                      </motion.button>
                    ))}
                  </div>
                ))}
              </div>

              <p className="mt-6 flex gap-2 text-[12px] leading-snug text-muted">
                <Icon name="shield" size={14} className="mt-px shrink-0" />
                <span>I only touch your basket when you ask, you can undo anything, and I never pay for anything. Food ideas, not medical advice.</span>
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
                  className="mb-4.5 flex flex-col items-end gap-1.5"
                >
                  {m.photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- a local data: URL, nothing for next/image to optimise
                    <img src={m.photo} alt="Your photo" className="max-h-56 max-w-[70%] rounded-[20px_20px_6px_20px] object-cover" />
                  )}
                  {m.text && (
                    <p className="max-w-[82%] rounded-[20px_20px_6px_20px] bg-carbon px-4 py-3 text-base leading-snug text-white">{m.text}</p>
                  )}
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
                      scopeName={scopeName}
                      onUndo={() => undo(m.id, ci, c)}
                      onApprove={() => c.type === "list" && approve(m.id, ci, c)}
                      onSkip={() => skipList(m.id, ci)}
                      onSend={(text) => send(text)}
                    />
                  ))}

                  {m.replies && mi === lastKachiIdx && mi === messages.length - 1 && (
                    // Kachi's suggested replies (or the answers to her question), arriving one after another.
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {m.replies.map((r, ri) => (
                        <motion.button
                          key={r}
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ ...spring.smooth, delay: 0.15 + ri * 0.07 }}
                          whileTap={{ scale: press.scale }}
                          onClick={() => {
                            haptic(6);
                            send(r);
                          }}
                          className="h-9.5 rounded-full bg-lavender/70 px-3.5 text-sm font-medium transition-colors hover:bg-lavender active:bg-lavender"
                        >
                          {r}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ),
            )
          )}
        </main>

        {/* Composer */}
        <div className="flex-none border-t border-hairline bg-surface px-3 pb-3 pt-2.5">
          <Link href="/basket" className="mb-2 ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-mint-pop/45 px-3 text-[13px]">
            <span className="h-2 w-2 rounded-full bg-[#0f7a48]" />
            <span>
              Adding to <b className="font-semibold">{deliveryLabel}</b>
            </span>
          </Link>

          {photo && <PhotoPreview src={photo} onRemove={() => setPhoto(null)} />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            autoComplete="off"
            className="flex min-h-13 items-center gap-1 rounded-full bg-soft-mist py-1 pr-1 pl-1.5 shadow-[inset_0_0_0_1.5px_transparent] transition-shadow focus-within:bg-paper-white focus-within:shadow-[inset_0_0_0_1.5px_var(--color-carbon)]"
          >
            <ComposerTools disabled={busy} onPhoto={setPhoto} onTranscript={(t) => setInput((i) => (i.trim() ? `${i.trim()} ${t}` : t))} onError={flash} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything…"
              aria-label="Message Kachi"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            <motion.button
              type="submit"
              aria-label="Send"
              disabled={busy || (!input.trim() && !photo)}
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
                <div key={t.id} className="flex items-center gap-2 border-b border-hairline">
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
