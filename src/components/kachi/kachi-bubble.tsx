"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { KachiMark } from "@/components/kachi-mark";
import { spring, press } from "@/lib/motion/tokens";
import type { KachiRecipe } from "@/lib/kachi-types";
import type { GuestKachiReply } from "@/app/api/kachi/route";
import { KACHI_HIDDEN, kachiContext } from "./kachi-context";

/**
 * Kachi, on every page: a small mark in the corner that opens a chat, and
 * now and then one short, page-aware offer of help beside it.
 *
 * Visitors only: members already have Kachi in the app (her tab in the dock,
 * the basket's "Get ideas", the planners), so the site layout mounts this
 * just for people who aren't signed in. Visitors talk to api/kachi, which
 * knows the public site and can change nothing.
 *
 * The nudge is the part that could annoy, so it is rationed: only after
 * someone has stayed and scrolled, never while they type, once per kind of
 * page, at most twice a visit, gone by itself after a while, and silenced for
 * a day by its ×. Opening the chat retires nudges for the visit.
 */

type Msg = {
  id: string;
  role: "me" | "kachi";
  text: string;
  recipes?: KachiRecipe[];
  suggestions?: string[];
  retry?: string;
};

type Saved = { msgs: Msg[] };

const STORE = "kachi-bubble";
const SNOOZE = "kachi-nudge-snooze-until";
const SEEN = "kachi-nudges-seen";
const NUDGE_DELAY_MS = 15_000;
const NUDGE_SHOW_MS = 14_000;
const NUDGES_PER_VISIT = 2;

/* Storage can be blocked (private mode, previews), so every read and write is guarded. */
function read<T>(store: () => Storage, key: string, fallback: T): T {
  try {
    const raw = store().getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(store: () => Storage, key: string, value: unknown) {
  try {
    store().setItem(key, JSON.stringify(value));
  } catch {}
}
const session = () => sessionStorage;
const local = () => localStorage;

const uid = () => Math.random().toString(36).slice(2, 10);

export function KachiBubble() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const hidden = KACHI_HIDDEN.some((r) => r.test(pathname));
  const isDesktop = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );

  const [open, setOpen] = useState(false);
  // One conversation per tab, carried across pages (and across the full
  // reload between the homepage and the rest of the site). The panel isn't
  // in the server HTML, so reading storage up front can't mismatch it.
  const [msgs, setMsgs] = useState<Msg[]>(() => (typeof window === "undefined" ? [] : (read<Saved | null>(session, STORE, null)?.msgs ?? []).slice(-30)));
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  // Tagged with the page it was offered on, so it simply stops showing elsewhere.
  const [nudge, setNudge] = useState<{ key: string; text: string; chips: string[] } | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The page's own name, for "Cooking the chicken shawarma bowl?" and for
  // telling Kachi where the visitor is. Read after the page sets its title.
  useEffect(() => {
    const t = window.setTimeout(() => setPageTitle(document.title.replace(/\s*(recipe)?\.\s*Basket$/i, "").replace(/^Basket\s*[—-].*$/, "")), 300);
    return () => window.clearTimeout(t);
  }, [pathname]);
  const ctx = kachiContext(pathname, false, pageTitle.toLowerCase());

  useEffect(() => {
    write(session, STORE, { msgs: msgs.slice(-30) } satisfies Saved);
  }, [msgs]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [msgs, thinking, open, reduce]);

  /* ------------------------------ the nudge ------------------------------ */

  useEffect(() => {
    if (hidden || open || !ctx.nudge) return;
    const snoozed = read<number>(local, SNOOZE, 0) > Date.now();
    const seen = read<string[]>(session, SEEN, []);
    const chatted = read<Saved | null>(session, STORE, null)?.msgs.length;
    if (snoozed || chatted || seen.includes(ctx.key) || seen.length >= NUDGES_PER_VISIT) return;

    const offer = { key: ctx.key, ...ctx.nudge };
    let scrolled = window.scrollY > window.innerHeight * 0.3;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.3) scrolled = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    let tick = 0;
    let hideTimer = 0;
    // After the delay, check every few seconds: shown only once they've
    // scrolled, the tab is in view, nothing else is open over the page, and
    // they aren't in the middle of typing.
    const start = window.setTimeout(() => {
      tick = window.setInterval(() => {
        const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
        if (!scrolled || typing || document.hidden || document.querySelector("[role=dialog]")) return;
        window.clearInterval(tick);
        write(session, SEEN, [...read<string[]>(session, SEEN, []), ctx.key]);
        setNudge(offer);
        hideTimer = window.setTimeout(() => setNudge(null), NUDGE_SHOW_MS);
      }, 3000);
    }, NUDGE_DELAY_MS);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(start);
      window.clearInterval(tick);
      window.clearTimeout(hideTimer);
    };
    // Re-arm per page; ctx is derived from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hidden, open]);

  const snooze = () => {
    write(local, SNOOZE, Date.now() + 24 * 60 * 60 * 1000);
    setNudge(null);
  };

  /* ------------------------------ the chat ------------------------------- */

  const pageContext = () => `${pageTitle || document.title} (${pathname})`;

  const send = useCallback(
    async (text: string, opts: { replay?: boolean } = {}) => {
      const message = text.trim();
      if (!message || thinking) return;
      const mine: Msg = { id: uid(), role: "me", text: message };
      const history = opts.replay ? msgs.filter((m) => !m.retry) : [...msgs, mine];
      setMsgs(history);
      setDraft("");
      setThinking(true);
      try {
        const turns = history
          .filter((m) => !m.retry)
          .slice(-8)
          .map((m) => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));
        const res = await fetch("/api/kachi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: turns, page: pageContext() }),
        });
        const data = (await res.json()) as GuestKachiReply;
        const reply: Msg = {
          id: uid(),
          role: "kachi",
          text: data.reply || "Something went wrong on my side.",
          recipes: data.recipes,
          suggestions: data.suggestions,
          retry: data.retry ? message : undefined,
        };
        setMsgs((m) => [...m, reply]);
      } catch {
        setMsgs((m) => [...m, { id: uid(), role: "kachi", text: "I couldn't reach the kitchen. Check your connection and try again.", retry: message }]);
      } finally {
        setThinking(false);
      }
    },
    // pageContext reads current state each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msgs, thinking, pathname, pageTitle],
  );

  const openWith = (text?: string) => {
    setNudge(null);
    setOpen(true);
    if (text) void send(text);
  };

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // The launcher steps aside while the footer is on screen, so it never sits on its links.
  const [atFooter, setAtFooter] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const io = new IntersectionObserver(([e]) => setAtFooter(e.isIntersecting), { rootMargin: "0px 0px -40px 0px" });
    io.observe(footer);
    return () => io.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // A sheet over the whole screen on phones: the page behind stays put.
    const prev = document.body.style.overflow;
    if (!isDesktop) document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, isDesktop]);

  if (hidden) return null;

  // Clear of the recipe page's sticky "get the ingredients" bar on phones.
  const onRecipe = /^\/recipes\/[^/]+$/.test(pathname);
  const lift = onRecipe ? "bottom-[5.5rem]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]";

  const last = msgs[msgs.length - 1];
  const showNudge = Boolean(nudge && nudge.key === ctx.key && !open);

  return (
    <>
      <div
        className={`fixed right-4 z-(--z-dock) flex flex-col items-end gap-3 transition-[opacity,translate] duration-300 lg:right-6 lg:bottom-6 ${lift} ${atFooter && !open ? "pointer-events-none translate-y-4 opacity-0" : ""}`}
        inert={atFooter && !open}
      >
        <AnimatePresence>
          {showNudge && (
            <motion.div
              key="nudge"
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={spring.sheet}
              style={{ transformOrigin: "bottom right" }}
              className="relative w-[min(300px,calc(100vw-2rem))] rounded-[22px] rounded-br-md bg-paper-white p-4 pr-10 text-carbon shadow-[0_18px_40px_-16px_rgb(0_0_0/0.35),0_0_0_1px_rgb(0_0_0/0.06)]"
            >
              <button
                type="button"
                onClick={snooze}
                aria-label="Not now, hide Kachi's tips for today"
                className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full text-carbon/50 hover:bg-soft-mist hover:text-carbon"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
              <p className="text-[13px] font-semibold text-carbon/60">Kachi</p>
              <p className="mt-0.5 text-[15px] leading-snug">{nudge!.text}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nudge!.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => openWith(c)}
                    className="h-8 rounded-full bg-soft-mist px-3 text-[13px] font-semibold transition-colors hover:bg-mint-pop"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!(open && !isDesktop) && (
          <motion.button
            ref={launcherRef}
            type="button"
            onClick={() => (open ? close() : openWith())}
            whileTap={{ scale: press.scale }}
            transition={spring.snappy}
            aria-expanded={open}
            aria-controls="kachi-panel"
            aria-label={open ? "Close Kachi" : "Ask Kachi, your food guide"}
            className="group relative grid h-14 w-14 place-items-center rounded-full shadow-[0_12px_28px_-10px_rgb(0_0_0/0.45)]"
          >
            <motion.span
              // A small, occasional tilt: she's there, and paying attention.
              animate={reduce || open ? { rotate: 0 } : { rotate: [0, -12, 8, 0] }}
              transition={reduce || open ? { duration: 0 } : { duration: 1.1, repeat: Infinity, repeatDelay: 9, ease: "easeInOut" }}
              className="block"
            >
              <KachiMark className="h-14 w-14" />
            </motion.span>
            {showNudge && <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-ember ring-2 ring-paper-white" aria-hidden />}
            <span className="pointer-events-none absolute right-full mr-3 hidden rounded-full bg-carbon px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-paper-white opacity-0 transition-opacity group-hover:opacity-100 lg:block">
              {open ? "Close" : "Ask Kachi"}
            </span>
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <>
            {!isDesktop && (
              <motion.button
                key="scrim"
                type="button"
                aria-label="Close Kachi"
                onClick={close}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-(--z-sheet) bg-carbon/40"
              />
            )}
            <motion.section
              key="panel"
              id="kachi-panel"
              role="dialog"
              aria-label="Chat with Kachi"
              initial={reduce ? { opacity: 0 } : isDesktop ? { opacity: 0, y: 16, scale: 0.97 } : { y: "100%" }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : isDesktop ? { opacity: 0, y: 12, scale: 0.98 } : { y: "100%" }}
              transition={spring.sheet}
              style={{ transformOrigin: "bottom right" }}
              className={`fixed z-(--z-sheet) flex flex-col overflow-hidden bg-paper-white text-carbon ${
                isDesktop
                  ? "right-6 bottom-24 h-[min(600px,calc(100svh-8rem))] w-[390px] rounded-[28px] shadow-[0_30px_70px_-24px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.06)]"
                  : "inset-x-0 bottom-0 h-[85svh] rounded-t-[28px]"
              }`}
            >
              <header className="flex items-center gap-3 border-b border-black/[0.07] px-5 py-3.5">
                <KachiMark className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] leading-tight font-semibold">Kachi</p>
                  <p className="text-[13px] text-carbon/55">{thinking ? "Thinking…" : "Here to help you eat well"}</p>
                </div>
                {msgs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMsgs([]);
                    }}
                    className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-carbon/60 hover:bg-soft-mist hover:text-carbon"
                  >
                    New
                  </button>
                )}
                <button type="button" onClick={close} aria-label="Close Kachi" className="grid h-9 w-9 place-items-center rounded-full bg-soft-mist">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" data-lenis-prevent aria-live="polite">
                <Bubble role="kachi">{ctx.greeting}</Bubble>
                {msgs.length === 0 && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {ctx.starters.map((s) => (
                      <Chip key={s} onClick={() => send(s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                )}

                {msgs.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <Bubble role={m.role}>{m.text}</Bubble>
                    {m.recipes && m.recipes.length > 0 && (
                      <div className="grid gap-2 pl-1">
                        {m.recipes.map((r) => (
                          <Link
                            key={r.slug}
                            href={`/recipes/${r.slug}`}
                            onClick={() => !isDesktop && close()}
                            className="flex items-center gap-3 rounded-[18px] bg-soft-mist px-3.5 py-3 transition-colors hover:bg-mint-pop/40"
                          >
                            <span className="min-w-0 flex-1">
                              <b className="block truncate text-[14px] font-semibold">{r.title}</b>
                              <span className="block truncate text-[13px] text-carbon/60">{r.summary}</span>
                            </span>
                            <span aria-hidden className="text-[18px]">→</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {m.retry && m === last && (
                      <Chip onClick={() => send(m.retry!, { replay: true })}>Try again</Chip>
                    )}
                    {m === last && !m.retry && m.suggestions && m.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {m.suggestions.map((s) => (
                          <Chip key={s} onClick={() => send(s)}>
                            {s}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {thinking && (
                  <div className="flex w-fit gap-1 rounded-[18px] rounded-bl-md bg-soft-mist px-4 py-3.5" aria-label="Kachi is typing">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-carbon/50"
                        animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                )}
                {msgs.filter((m) => m.role === "me").length >= 4 && (
                  <p className="rounded-[18px] bg-mint-pop/30 px-4 py-3 text-[13px] leading-relaxed">
                    Want me to remember this and build your basket?{" "}
                    <Link href="/start" className="font-semibold underline underline-offset-2">
                      Get started
                    </Link>
                    . It&apos;s free, and nothing is charged until you check out.
                  </p>
                )}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(draft);
                }}
                className="border-t border-black/[0.07] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <div className="flex items-end gap-2 rounded-[22px] bg-soft-mist p-1.5 pl-4">
                  <label htmlFor="kachi-input" className="sr-only">
                    Message Kachi
                  </label>
                  <textarea
                    id="kachi-input"
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    maxLength={600}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(draft);
                      }
                    }}
                    placeholder="Ask about recipes, produce, prices…"
                    className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-carbon/45"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || thinking}
                    aria-label="Send"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-carbon text-paper-white transition-opacity disabled:opacity-30"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M10 16V4M5 9l5-5 5 5" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-carbon/45">Food guidance, not medical advice.</p>
              </form>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, children }: { role: "me" | "kachi"; children: React.ReactNode }) {
  return (
    <p
      className={`max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px] leading-snug whitespace-pre-line ${
        role === "me" ? "ml-auto rounded-br-md bg-carbon text-paper-white" : "rounded-bl-md bg-soft-mist"
      }`}
    >
      {children}
    </p>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-full bg-paper-white px-3.5 text-[13px] font-semibold shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.12)] transition-colors hover:bg-mint-pop/40"
    >
      {children}
    </button>
  );
}
