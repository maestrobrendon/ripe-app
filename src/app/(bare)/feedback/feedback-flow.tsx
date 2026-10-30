"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { formatNaira } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { KachiMark } from "@/components/kachi-mark";
import { submitFeedback, type FeedbackInput } from "./actions";

/*
 * /feedback: one question at a time, the way sign-up works. Every question
 * can be skipped; taps move on by themselves, typing waits for Continue.
 * The page's colour follows how they said they feel. At the end: thanks,
 * and the reward (credited now if signed in, on sign-in if not).
 */

const MOODS = [
  { v: 1, face: "😞", label: "Not happy", bg: "#ffe3e0" },
  { v: 2, face: "😕", label: "Meh", bg: "#ffeedd" },
  { v: 3, face: "😐", label: "Okay", bg: "#fff6d6" },
  { v: 4, face: "🙂", label: "Good", bg: "#e8f7e3" },
  { v: 5, face: "😍", label: "Love it", bg: "#d8f5e6" },
];

const LOVES = ["Freshness", "Prices", "Recipes", "Kachi", "Delivery", "Reminders", "Choosing my day", "The app", "Member prices"];
const IMPROVE = ["Prices", "More produce", "Delivery times", "More areas", "Recipes", "Paying", "The app", "Reminders", "Customer support"];
const DRIVERS = [
  { id: "cheaper", emoji: "💸", label: "Lower prices" },
  { id: "variety", emoji: "🥭", label: "More variety" },
  { id: "timing", emoji: "📅", label: "Days that fit my week" },
  { id: "recipes", emoji: "🍳", label: "Recipes I'd actually cook" },
  { id: "faster", emoji: "🛵", label: "Faster delivery" },
  { id: "already", emoji: "✅", label: "I already do" },
];
const RECIPE_IDEAS = ["Nigerian breakfasts", "Lunchbox ideas", "Quick 15-minute dinners", "Fruit snacks", "Meals for kids"];

type Step = "intro" | "mood" | "nps" | "loves" | "improve" | "driver" | "recipe" | "message" | "contact" | "done";
const QUESTIONS: Step[] = ["mood", "nps", "loves", "improve", "driver", "recipe", "message", "contact"];

export function FeedbackFlow({ firstName, signedIn, reward }: { firstName: string | null; signedIn: boolean; reward: number }) {
  const still = useReducedMotion();
  const [step, setStep] = useState<Step>("intro");
  const [dir, setDir] = useState<1 | -1>(1);
  const [a, setA] = useState<FeedbackInput>({ mood: null, nps: null, loves: [], improve: [], weeklyDriver: null, recipeWish: "", message: "", contactOk: false, contact: "" });
  const [result, setResult] = useState<{ reward: "credited" | "already" | "claim-by-signing-in"; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const index = QUESTIONS.indexOf(step);
  const mood = MOODS.find((m) => m.v === a.mood);
  const bg = step === "done" ? "#d8f5e6" : (mood?.bg ?? "#ffffff");

  const go = (to: Step, d: 1 | -1 = 1) => {
    setDir(d);
    setStep(to);
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    haptic("light");
    const i = QUESTIONS.indexOf(step);
    if (step === "intro") return go("mood");
    if (i === QUESTIONS.length - 1) return finish();
    go(QUESTIONS[i + 1]);
  };
  const back = () => {
    const i = QUESTIONS.indexOf(step);
    go(i <= 0 ? "intro" : QUESTIONS[i - 1], -1);
  };
  /** A tap answer: show it chosen for a beat, then move on. */
  const pickThen = (fn: () => void) => {
    fn();
    haptic("selection");
    window.setTimeout(next, 380);
  };

  const finish = () => {
    setError(null);
    start(async () => {
      const r = await submitFeedback(a);
      if (!r.ok) {
        setError(r.error);
        haptic("error");
        return;
      }
      track("feedback_submitted", { mood: a.mood, nps: a.nps, reward: r.reward });
      setResult({ reward: r.reward, amount: r.amount });
      haptic("success");
      go("done");
    });
  };

  // Enter moves on from any screen where typing isn't in a multi-line box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || (e.target as HTMLElement)?.tagName === "TEXTAREA" || step === "done") return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = (key: "loves" | "improve", v: string) => {
    haptic("selection");
    setA((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));
  };

  const cta: Partial<Record<Step, string>> = {
    intro: "Let's go",
    loves: a.loves.length ? "Continue" : "Skip",
    improve: a.improve.length ? "Continue" : "Skip",
    recipe: a.recipeWish.trim() ? "Continue" : "Skip",
    message: a.message.trim() ? "Continue" : "Skip",
    contact: pending ? "Sending…" : "Send my answers",
    mood: "Skip",
    nps: "Skip",
    driver: "Skip",
  };

  const kachi: Partial<Record<Step, string>> = {
    mood: `${firstName ? `${firstName}, f` : "F"}irst things first.`,
    nps: mood && mood.v >= 4 ? "Glad to hear it." : mood && mood.v <= 2 ? "Sorry about that. Tell me more as we go." : "Thanks. Next one.",
    loves: "Tap all that apply.",
    improve: "Be honest, this is the useful bit.",
    driver: "This one helps us plan.",
    recipe: "I'll pass this to the kitchen.",
    message: "Anything at all. I read every one.",
    contact: "Last one, promise.",
  };

  return (
    <motion.div className="hm min-h-svh text-carbon" animate={{ backgroundColor: bg }} transition={{ duration: 0.6 }}>
      <header className="sticky top-0 z-30">
        <div className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center gap-4">
          {step === "intro" || step === "done" ? (
            <Link href="/" className="logo-wordmark text-[22px] leading-none">
              BasketNG
            </Link>
          ) : (
            <motion.button type="button" onClick={back} whileTap={{ scale: press.scale }} aria-label="Back" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5">
              <Icon name="caretLeft" size={20} />
            </motion.button>
          )}
          {index >= 0 && (
            <>
              <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Feedback" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={index + 1}>
                {QUESTIONS.map((q, i) => (
                  <span key={q} className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/8">
                    <motion.span className="block h-full origin-left rounded-full bg-carbon" initial={false} animate={{ scaleX: i <= index ? 1 : 0 }} transition={spring.smooth} />
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-carbon/50 tabular-nums">
                {index + 1}/{QUESTIONS.length}
              </span>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-[min(560px,calc(100%-32px))] pt-4 pb-44">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            variants={{ enter: (d: number) => ({ x: 40 * d, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -40 * d, opacity: 0 }) }}
            initial={still ? false : "enter"}
            animate="center"
            exit="exit"
            transition={spring.smooth}
          >
            {kachi[step] && <Say>{kachi[step]}</Say>}

            {step === "intro" && (
              <div className="pt-6 text-center">
                <motion.p initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={spring.juicy} className="text-[64px] leading-none" aria-hidden>
                  💬
                </motion.p>
                <h1 className="mt-5 text-[clamp(2rem,7vw,2.6rem)] leading-[1.04] font-semibold tracking-[-0.045em] text-balance">
                  {firstName ? `${firstName}, how` : "How"} are we doing?
                </h1>
                <p className="mx-auto mt-3 max-w-[24rem] text-[17px] leading-snug text-carbon/65">Two minutes, eight quick questions, one at a time. Skip anything you like.</p>
                {reward > 0 && (
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ ...spring.smooth, delay: 0.25 }}
                    className="mx-auto mt-7 flex w-fit items-center gap-2.5 rounded-full bg-[#fff1c2] px-5 py-3 text-[15px] font-semibold"
                  >
                    <span aria-hidden>🎁</span> {formatNaira(reward)} credit when you finish
                  </motion.p>
                )}
              </div>
            )}

            {step === "mood" && (
              <>
                <Q>How do you feel about BasketNG so far?</Q>
                <div className="mt-8 grid grid-cols-5 gap-2" role="radiogroup" aria-label="How you feel">
                  {MOODS.map((m) => {
                    const on = a.mood === m.v;
                    return (
                      <motion.button
                        key={m.v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={m.label}
                        whileTap={{ scale: 0.88 }}
                        animate={{ scale: on ? 1.12 : 1, y: on ? -6 : 0 }}
                        transition={spring.juicy}
                        onClick={() => pickThen(() => setA((s) => ({ ...s, mood: m.v })))}
                        className={`flex flex-col items-center gap-2 rounded-[20px] py-4 ${on ? "bg-paper-white shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                      >
                        <span className="text-[34px] leading-none sm:text-[40px]">{m.face}</span>
                        <span className="text-[11px] font-semibold text-carbon/60 sm:text-[12px]">{m.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === "nps" && (
              <>
                <Q>How likely are you to tell a friend about us?</Q>
                <div className="mt-8 grid grid-cols-6 gap-2 sm:grid-cols-11" role="radiogroup" aria-label="From 0 to 10">
                  {Array.from({ length: 11 }, (_, n) => {
                    const on = a.nps === n;
                    const tone = n <= 6 ? "#ffd8d0" : n <= 8 ? "#fff1c2" : "#c9f0d8";
                    return (
                      <motion.button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        whileTap={{ scale: 0.88 }}
                        initial={still ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0, scale: on ? 1.1 : 1 }}
                        transition={{ ...spring.juicy, delay: still ? 0 : n * 0.025 }}
                        onClick={() => pickThen(() => setA((s) => ({ ...s, nps: n })))}
                        style={{ backgroundColor: on ? "#000" : tone }}
                        className={`grid h-13 place-items-center rounded-2xl text-[18px] font-semibold tabular-nums ${on ? "text-paper-white" : ""}`}
                      >
                        {n}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between text-[13px] text-carbon/55">
                  <span>Not likely</span>
                  <span>Very likely</span>
                </div>
              </>
            )}

            {(step === "loves" || step === "improve") && (
              <>
                <Q>{step === "loves" ? "What do you love most?" : "What should we do better?"}</Q>
                <div className="mt-7 flex flex-wrap gap-2.5">
                  {(step === "loves" ? LOVES : IMPROVE).map((v, i) => {
                    const on = a[step].includes(v);
                    return (
                      <motion.button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        whileTap={{ scale: 0.92 }}
                        initial={still ? false : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...spring.juicy, delay: still ? 0 : i * 0.03 }}
                        onClick={() => toggle(step, v)}
                        className={`inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors ${on ? "bg-carbon text-paper-white" : "bg-black/[0.05] hover:bg-black/[0.08]"}`}
                      >
                        {on && <span aria-hidden>✓</span>}
                        {v}
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === "driver" && (
              <>
                <Q>What would make you order every week?</Q>
                <div className="mt-7 grid grid-cols-2 gap-2.5">
                  {DRIVERS.map((d) => {
                    const on = a.weeklyDriver === d.label;
                    return (
                      <motion.button
                        key={d.id}
                        type="button"
                        aria-pressed={on}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => pickThen(() => setA((s) => ({ ...s, weeklyDriver: d.label })))}
                        className={`flex min-h-24 flex-col items-start justify-between rounded-[20px] p-4 text-left transition-colors ${on ? "bg-carbon text-paper-white" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                      >
                        <span className="text-[26px] leading-none" aria-hidden>
                          {d.emoji}
                        </span>
                        <span className="mt-3 text-[15px] leading-tight font-semibold">{d.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === "recipe" && (
              <>
                <Q>Which recipes would you love to see?</Q>
                <input
                  autoFocus
                  value={a.recipeWish}
                  onChange={(e) => setA((s) => ({ ...s, recipeWish: e.target.value }))}
                  placeholder="e.g. more Nigerian breakfasts"
                  maxLength={300}
                  className="mt-7 h-14 w-full rounded-[18px] bg-paper-white px-4 text-[17px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus:shadow-[0_0_0_2px_#000]"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {RECIPE_IDEAS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        haptic("selection");
                        setA((s) => ({ ...s, recipeWish: s.recipeWish ? `${s.recipeWish}, ${r.toLowerCase()}` : r }));
                      }}
                      className="rounded-full bg-black/[0.05] px-3.5 py-2 text-[13px] font-medium hover:bg-black/[0.08]"
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "message" && (
              <>
                <Q>Anything else? Ideas, complaints, love notes.</Q>
                <textarea
                  autoFocus
                  value={a.message}
                  onChange={(e) => setA((s) => ({ ...s, message: e.target.value }))}
                  placeholder="Say it the way you'd say it to a friend."
                  rows={6}
                  maxLength={3000}
                  className="mt-7 w-full resize-none rounded-[18px] bg-paper-white p-4 text-[17px] leading-relaxed shadow-[0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus:shadow-[0_0_0_2px_#000]"
                />
                <p className="mt-2 text-right text-[12px] text-carbon/45 tabular-nums">{a.message.length}/3000</p>
              </>
            )}

            {step === "contact" && (
              <>
                <Q>Can we get back to you about your answers?</Q>
                <div className="mt-7 grid grid-cols-2 gap-2.5">
                  {[
                    { v: true, label: "Yes, sure", emoji: "👍" },
                    { v: false, label: "No, thanks", emoji: "🙏" },
                  ].map((o) => (
                    <motion.button
                      key={o.label}
                      type="button"
                      aria-pressed={a.contactOk === o.v}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        haptic("selection");
                        setA((s) => ({ ...s, contactOk: o.v }));
                      }}
                      className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-[20px] text-[15px] font-semibold transition-colors ${a.contactOk === o.v ? "bg-carbon text-paper-white" : "bg-black/[0.04]"}`}
                    >
                      <span className="text-[26px] leading-none" aria-hidden>
                        {o.emoji}
                      </span>
                      {o.label}
                    </motion.button>
                  ))}
                </div>
                {a.contactOk && !signedIn && (
                  <input
                    value={a.contact}
                    onChange={(e) => setA((s) => ({ ...s, contact: e.target.value }))}
                    placeholder="Your WhatsApp number or email"
                    maxLength={120}
                    className="mt-4 h-14 w-full rounded-[18px] bg-paper-white px-4 text-[17px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus:shadow-[0_0_0_2px_#000]"
                  />
                )}
                {a.contactOk && signedIn && <p className="mt-4 text-[14px] text-carbon/60">We&apos;ll use the number or email on your account.</p>}
                {error && (
                  <p role="alert" className="mt-4 rounded-[18px] bg-ember/12 p-4 text-[14px]">
                    {error}
                  </p>
                )}
              </>
            )}

            {step === "done" && result && <Thanks result={result} signedIn={signedIn} mood={a.mood} />}
          </motion.section>
        </AnimatePresence>
      </main>

      {step !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-30 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]" style={{ background: `linear-gradient(to top, ${bg} 70%, transparent)` }}>
          <div className="mx-auto w-[min(560px,calc(100%-32px))]">
            <motion.button
              type="button"
              onClick={next}
              disabled={pending}
              whileTap={{ scale: press.scale }}
              transition={spring.snappy}
              className={`flex h-14 w-full items-center justify-center rounded-full text-[16px] font-semibold transition-colors disabled:opacity-60 ${
                cta[step] === "Skip" ? "bg-black/[0.07] text-carbon" : "bg-carbon text-paper-white"
              }`}
            >
              {cta[step]}
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Say({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <KachiMark className="mt-0.5 h-8 w-8" />
      <p className="rounded-[18px] rounded-tl-md bg-paper-white/80 px-4 py-2.5 text-[15px] leading-snug">{children}</p>
    </div>
  );
}

function Q({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-6 text-[clamp(1.75rem,6vw,2.25rem)] leading-[1.06] font-semibold tracking-[-0.04em] text-balance">{children}</h1>;
}

/** Confetti made of produce, falling once. */
function Confetti() {
  const still = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        emoji: ["🍊", "🥑", "🍍", "🥭", "🍉", "🥕", "🍋", "🌶️", "🥒", "🍌"][i % 10],
        left: (i * 37) % 100,
        delay: (i % 9) * 0.08,
        spin: (i % 2 ? 1 : -1) * (180 + (i % 5) * 60),
        size: 18 + (i % 4) * 6,
      })),
    [],
  );
  if (still) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-0"
          style={{ left: `${b.left}%`, fontSize: b.size }}
          initial={{ y: -60, opacity: 0, rotate: 0 }}
          animate={{ y: "105vh", opacity: [0, 1, 1, 0], rotate: b.spin }}
          transition={{ duration: 2.6 + (i % 3) * 0.4, delay: b.delay, ease: "easeIn" }}
        >
          {b.emoji}
        </motion.span>
      ))}
    </div>
  );
}

function Thanks({ result, signedIn, mood }: { result: { reward: "credited" | "already" | "claim-by-signing-in"; amount: number }; signedIn: boolean; mood: number | null }) {
  return (
    <div className="pt-6 text-center">
      <Confetti />
      <motion.p initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={spring.juicy} className="text-[72px] leading-none" aria-hidden>
        {result.reward === "credited" ? "🎁" : "🙏"}
      </motion.p>
      <h1 className="mt-5 text-[clamp(2rem,7vw,2.6rem)] leading-[1.04] font-semibold tracking-[-0.045em] text-balance">
        {result.reward === "credited" ? `${formatNaira(result.amount)} is yours.` : "Thank you."}
      </h1>
      <p className="mx-auto mt-3 max-w-[24rem] text-[17px] leading-snug text-carbon/65">
        {result.reward === "credited"
          ? "It's in your account and comes off your next basket. Thank you for telling us."
          : result.reward === "claim-by-signing-in"
            ? "Your answers are in. Sign in or create a free account and your credit is added straight away."
            : mood && mood <= 2
              ? "We're sorry it hasn't been great. We read every answer, and we'll do better."
              : "Your answers are in. We read every one, and they shape what we do next."}
      </p>
      <div className="mx-auto mt-8 grid max-w-[22rem] gap-2.5">
        {result.reward === "claim-by-signing-in" ? (
          <>
            <Link href="/start" className="flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white">
              Create a free account
            </Link>
            <Link href="/login?next=/account" className="flex h-12 items-center justify-center rounded-full bg-black/[0.06] text-[15px] font-semibold">
              I have an account
            </Link>
          </>
        ) : (
          <>
            <Link href={signedIn ? "/basket" : "/"} className="flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white">
              {signedIn ? "Back to my basket" : "Back to BasketNG"}
            </Link>
            <Link href="/gift" className="flex h-12 items-center justify-center rounded-full bg-black/[0.06] text-[15px] font-semibold">
              🎁 Gift someone a basket
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
