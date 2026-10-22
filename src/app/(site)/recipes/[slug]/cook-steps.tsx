"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ProductImage } from "@/components/product-image";
import { Check, shortName } from "@/app/(bare)/home-menu/parts/shared";
import type { RecipeProduct } from "../recipe-data";

/** Last words too generic to stand for an ingredient on their own ("garden egg" is not "an egg"). */
const GENERIC = new Set(["egg", "fruit", "mix"]);

/**
 * Which basket ingredients a step mentions, so each step can show what to
 * reach for. Tries the full name from the slug ("green mango"), then its last
 * word ("lettuce" for romaine lettuce). A plural or "-y" ending still counts.
 */
function usesIn(step: string, products: RecipeProduct[]) {
  const text = step.toLowerCase();
  return products.filter((p) => {
    const words = p.slug.split("-");
    const tries = [words.join(" ")];
    const last = words[words.length - 1];
    if (words.length > 1 && !GENERIC.has(last)) tries.push(last);
    return tries.some((t) => new RegExp(`\\b${t}`).test(text));
  });
}

type WakeLock = { release: () => Promise<void> };

// Ticked steps live in sessionStorage, read as an external store so the
// server render (nothing ticked) and the first client render agree.
const STEPS_EVENT = "recipe-steps-change";
const subscribeSteps = (onChange: () => void) => {
  window.addEventListener(STEPS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STEPS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};
// Storage can be blocked; then the ticks live here and are lost on reload.
const memory = new Map<string, string>();
const readSteps = (key: string) => {
  try {
    return sessionStorage.getItem(key) ?? memory.get(key) ?? "[]";
  } catch {
    return memory.get(key) ?? "[]";
  }
};
const noSubscribe = () => () => {};

/**
 * The method, written to cook from: numbered steps you can tick off as you
 * go (kept for this tab only), each showing the ingredients it uses, and a
 * switch that stops the phone dimming while your hands are busy.
 */
export function CookSteps({ slug, steps, products, tools }: { slug: string; steps: string[]; products: RecipeProduct[]; tools: string[] }) {
  const storageKey = `recipe-steps:${slug}`;
  const raw = useSyncExternalStore(subscribeSteps, () => readSteps(storageKey), () => "[]");
  const done = useMemo(() => {
    try {
      const saved: unknown = JSON.parse(raw);
      return new Set(Array.isArray(saved) ? saved.filter((n): n is number => typeof n === "number") : []);
    } catch {
      return new Set<number>();
    }
  }, [raw]);
  const canWake = useSyncExternalStore(noSubscribe, () => "wakeLock" in navigator, () => false);
  const [awake, setAwake] = useState(false);
  const lock = useRef<WakeLock | null>(null);
  const uses = useMemo(() => steps.map((s) => usesIn(s, products)), [steps, products]);

  const toggle = (i: number) => {
    // Read the store, not `done`: two quick taps land before a re-render.
    let next: Set<number>;
    try {
      next = new Set((JSON.parse(readSteps(storageKey)) as unknown[]).filter((n): n is number => typeof n === "number"));
    } catch {
      next = new Set();
    }
    if (next.has(i)) next.delete(i);
    else next.add(i);
    const value = JSON.stringify([...next]);
    memory.set(storageKey, value);
    try {
      sessionStorage.setItem(storageKey, value);
    } catch {}
    window.dispatchEvent(new Event(STEPS_EVENT));
  };

  // The browser drops a wake lock whenever the tab is hidden, so take it
  // again on the way back.
  useEffect(() => {
    if (!awake) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
        const l = await nav.wakeLock?.request("screen");
        if (cancelled) await l?.release();
        else lock.current = l ?? null;
      } catch {
        setAwake(false);
      }
    };
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [awake]);

  return (
    <section aria-labelledby="steps-title" id="steps" className="scroll-mt-28">
      {tools.length > 0 && (
        <div className="mb-10">
          <h2 className="hm-h3 text-[1.35rem]!">You&apos;ll need</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {tools.map((t) => (
              <li key={t} className="inline-flex h-9 items-center rounded-full bg-[var(--hm-tint)] px-3.5 text-[14px] font-medium">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="steps-title" className="hm-h3 text-[1.6rem]!">
            Cooking steps
          </h2>
          <p className="mt-1 text-[14px] text-[var(--hm-ink-2)]" aria-live="polite">
            {done.size === 0 ? "Tap a step when it's done." : done.size === steps.length ? "All done. Enjoy it." : `${done.size} of ${steps.length} done`}
          </p>
        </div>
        {canWake && (
          <button
            type="button"
            role="switch"
            aria-checked={awake}
            onClick={() => setAwake((a) => !a)}
            className="inline-flex h-10 items-center gap-2.5 rounded-full bg-[var(--hm-tint)] pr-4 pl-1.5 text-[14px] font-semibold"
          >
            <span className={`relative h-7 w-12 rounded-full transition-colors ${awake ? "bg-carbon" : "bg-carbon/20"}`} aria-hidden>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-paper-white transition-[left] ${awake ? "left-6" : "left-1"}`} />
            </span>
            Keep screen on
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--hm-tint)]" aria-hidden>
        <div className="h-full rounded-full bg-mint-pop transition-[width] duration-(--dur-slow)" style={{ width: `${(done.size / steps.length) * 100}%` }} />
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((step, i) => {
          const isDone = done.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={isDone}
                onClick={() => toggle(i)}
                className={`flex w-full gap-4 rounded-[22px] p-4 text-left transition-colors sm:gap-5 sm:p-5 ${isDone ? "bg-[var(--hm-tint)]" : "bg-paper-white shadow-[0_0_0_1px_var(--hm-line)] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.2)]"}`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[16px] font-bold transition-colors ${isDone ? "bg-mint-pop" : "bg-carbon text-paper-white"}`}
                  aria-hidden
                >
                  {isDone ? <Check className="h-5 w-5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">Step {i + 1}{isDone ? ", done" : ""}. </span>
                  <span className={`block text-[16px] leading-relaxed sm:text-[17px] ${isDone ? "text-[var(--hm-ink-3)] line-through decoration-carbon/30" : ""}`}>{step}</span>
                  {uses[i].length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {uses[i].map((p) => (
                        <span key={p.id} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--hm-tint)] py-0.5 pr-2.5 pl-0.5 text-[12px] font-medium">
                          <ProductImage
                            publicId={p.cloudinaryPublicId}
                            alt=""
                            emoji={p.imageEmoji}
                            sizes="24px"
                            rounded="rounded-full"
                            flavour="bg-[var(--hm-tint-2)]"
                            emojiClassName="text-xs"
                            className="h-6 w-6"
                          />
                          {shortName(p.name)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
