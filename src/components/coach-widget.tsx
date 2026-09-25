"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { LEVELS, type CoachProgress } from "@/lib/coach";
import { SUPPORT_WHATSAPP } from "@/lib/site";
import type { StreakView } from "@/lib/streak-config";
import type { CoachReply } from "@/app/api/coach/route";

type Payload = {
  signedIn: boolean;
  firstName: string | null;
  progress: CoachProgress;
  streak: StreakView | null;
  replies: CoachReply[];
};

type Turn = { question: string; reply: CoachReply };

export function CoachWidget() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Loaded on first open so the widget costs a closed page nothing.
  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach");
        if (res.ok && !cancelled) setData((await res.json()) as Payload);
      } catch {
        /* the panel still works as a support link without progress */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const ask = (reply: CoachReply) => setTurns((t) => [...t, { question: reply.question, reply }]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = draft.trim();
    if (!question || asking) return;
    setDraft("");
    setAsking(true);
    try {
      const res = await fetch("/api/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question }),
      });
      const reply = (await res.json()) as CoachReply;
      setTurns((t) => [...t, { question, reply: { ...reply, question } }]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          question,
          reply: {
            id: "offline",
            question,
            answer: "That did not go through. Check your connection and try again.",
          },
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const asked = new Set(turns.map((t) => t.reply.id));
  const remaining = data?.replies.filter((r) => !asked.has(r.id)) ?? [];
  const progress = data?.progress;

  return (
    <>
      {open && (
        <div className="fixed inset-x-4 bottom-24 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-card-lg border border-border bg-surface shadow-xl sm:inset-x-auto sm:right-5 sm:w-96">
          {/* Progress header: level, points, and the bar to the next level */}
          <div className="shrink-0 bg-basket-green p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Basket coach</p>
                <p className="text-xs text-white/70">
                  {data?.firstName ? `Hello ${data.firstName}` : "Your trained produce assistant"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close the coach"
                className="tap-target -mr-1 -mt-1 rounded-full p-1 text-white/80 hover:text-white"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {progress && (
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold">
                    Level {progress.level.index}. {progress.level.title}
                  </span>
                  <span className="text-white/70">{progress.points} points</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${progress.progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/70">
                  {progress.nextLevel
                    ? `${progress.pointsToNext} points to ${progress.nextLevel.title}`
                    : `Top level of ${LEVELS.length}. Nothing left to climb.`}
                </p>
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {!data && <p className="text-sm text-muted">Waking up…</p>}

            {data && turns.length === 0 && (
              <p className="text-sm text-muted">
                {data.signedIn
                  ? "Tap a question below or type your own. I can help with what is in season, delivery, pricing, rewards and what we stock."
                  : "Type a question or tap one below. Points and rewards start building once you have an account."}
              </p>
            )}

            {turns.map((turn, i) => (
              <div key={`${turn.reply.id}-${i}`} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-card bg-basket-green-light px-3 py-2 text-sm font-medium text-basket-green-dark">
                  {turn.question}
                </p>

                <div className="w-fit max-w-[90%] rounded-card border border-border px-3 py-2 text-sm">
                  <p>{turn.reply.answer}</p>

                  {turn.reply.products && turn.reply.products.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {turn.reply.products.map((p) => (
                        <li key={p.slug}>
                          <Link
                            href={`/products/${p.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 rounded-card p-1 hover:bg-basket-green-light"
                          >
                            <ProductImage
                              publicId={p.cloudinaryPublicId}
                              alt={p.name}
                              emoji={p.imageEmoji}
                              className="h-9 w-9 shrink-0"
                              rounded="rounded-full"
                              emojiClassName="text-base"
                              sizes="36px"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                            <span className="shrink-0 text-xs text-muted">{formatNaira(p.price)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {turn.reply.id === "human" ? (
                    <a
                      href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
                        "Hi Basket, I have a question about",
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-basket-green underline"
                    >
                      Open WhatsApp
                    </a>
                  ) : (
                    turn.reply.link && (
                      <Link
                        href={turn.reply.link.href}
                        onClick={() => setOpen(false)}
                        className="mt-3 inline-block text-sm font-semibold text-basket-green underline"
                      >
                        {turn.reply.link.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Quick replies, then a free-text box for anything not on them */}
          <div className="shrink-0 border-t border-border p-3">
            {remaining.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {remaining.map((reply) => (
                  <button
                    key={reply.id}
                    onClick={() => ask(reply)}
                    className="tap-target rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-basket-green hover:bg-basket-green-light"
                  >
                    {reply.question}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask anything about Basket"
                aria-label="Ask the coach a question"
                maxLength={200}
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={asking || draft.trim().length < 2}
                aria-label="Send question"
                className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-basket-green text-white transition hover:bg-basket-green-dark disabled:opacity-40"
              >
                {asking ? (
                  <Icon name="spinner" size={18} className="animate-spin" />
                ) : (
                  <Icon name="send" size={18} />
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close the Basket coach" : "Open the Basket coach"}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-basket-green px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-basket-green-dark"
      >
        <Icon name={open ? "close" : "reward"} size={20} />
        <span className="hidden sm:inline">{open ? "Close" : "Ask the coach"}</span>
        {!open && progress && progress.level.index > 1 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
            Lv {progress.level.index}
          </span>
        )}
      </button>
    </>
  );
}
