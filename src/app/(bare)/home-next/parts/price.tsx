"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Minus, Plus } from "@phosphor-icons/react";
import { gsap } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { buildStarterPicks, type StarterCandidate } from "@/lib/starter-basket-core";
import { RollingNumber } from "@/components/ui/rolling-number";
import { MagneticLink, Reveal } from "./runtime";
import { ProduceSticker } from "./produce";

type Plan = "once" | "member";

/** Counts from the last shown total to the new one. */
function CountTo({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  // React renders the first figure only; after that GSAP owns the text, so
  // a re-render never flashes the final number before the count runs.
  const [initial] = useState(() => formatNaira(value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = formatNaira(value);
      shown.current = value;
      return;
    }
    const state = { v: shown.current };
    const tween = gsap.to(state, {
      v: value,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = formatNaira(state.v);
      },
      onComplete: () => {
        shown.current = value;
      },
    });
    return () => {
      shown.current = state.v;
      tween.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {initial}
    </span>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-14 items-center justify-between rounded-2xl border border-carbon pr-1.5 pl-4">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-10 w-10 place-items-center rounded-full bg-soft-mist disabled:opacity-35"
        >
          <Minus weight="bold" className="h-4 w-4" />
        </button>
        <RollingNumber value={value} className="min-w-6 justify-center text-center font-semibold" />
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-10 w-10 place-items-center rounded-full bg-soft-mist disabled:opacity-35"
        >
          <Plus weight="bold" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Price({
  candidates,
  memberFee,
  freeDeliveryThreshold,
  signedIn,
}: {
  candidates: StarterCandidate[];
  memberFee: number | null;
  freeDeliveryThreshold: number;
  signedIn: boolean;
}) {
  const [plan, setPlan] = useState<Plan>("once");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const member = plan === "member" && memberFee != null;

  const picks = useMemo(
    () => buildStarterPicks({ goalSlug: null, producePreferences: [], adults, kids }, candidates),
    [adults, kids, candidates],
  );
  const produce = picks.reduce((s, p) => s + (member ? p.memberPrice : p.standardPrice) * p.quantity, 0);
  const delivery = quoteDelivery(produce, member);
  const membershipWeekly = member && memberFee ? Math.round((memberFee * 12) / 52) : 0;
  const total = produce + delivery.fee + membershipWeekly;

  return (
    <section id="price" className="bg-sky-wash py-24 sm:py-32">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] items-center gap-14 sm:w-[min(1180px,calc(100%-48px))] lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal>
            <h2 className="hn-display text-[clamp(2.6rem,5vw,4.6rem)]">What a week costs.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-[30rem] text-lg leading-relaxed text-carbon/75">
              Set your household and see a real number, priced both ways. No hidden fees and no minimum order. Delivery is free on member baskets, and on any order over{" "}
              {formatNaira(freeDeliveryThreshold)}.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-8 text-sm font-semibold">What would be in it</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {picks.map((p) => (
                  <motion.span
                    key={p.productId}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={spring.juicy}
                    className="inline-flex items-center gap-2 rounded-full border border-carbon bg-paper-white py-1 pr-3 pl-1 text-sm"
                  >
                    <ProduceSticker name={p.name} publicId={p.cloudinaryPublicId} emoji={p.imageEmoji} rounded="rounded-full" className="h-7 w-7" emojiClassName="text-base" sizes="28px" />
                    {p.name}
                    <b className="font-semibold tabular-nums">×{p.quantity}</b>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="rounded-card-lg border border-carbon bg-paper-white p-6.5">
            {memberFee != null && (
              <LayoutGroup id="hn-plan">
                <div className="flex rounded-2xl bg-soft-mist p-1" role="radiogroup" aria-label="How you pay">
                  {(
                    [
                      ["once", "Buy once"],
                      ["member", "As a member"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={plan === k}
                      onClick={() => setPlan(k)}
                      className={`relative h-11 flex-1 rounded-xl text-[15px] font-semibold transition-colors ${plan === k ? "text-paper-white" : "text-carbon/65"}`}
                    >
                      {plan === k && <motion.span layoutId="hn-plan-pill" transition={spring.indicator} className="absolute inset-0 rounded-xl bg-carbon" />}
                      <span className="relative">{label}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Stepper label="Adults" value={adults} min={1} max={8} onChange={setAdults} />
              <Stepper label="Children" value={kids} min={0} max={8} onChange={setKids} />
            </div>

            <div className="mt-6 flex items-baseline justify-between gap-4">
              <CountTo value={total} className="text-[clamp(2.4rem,5vw,2.9rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums" />
              <small className="text-sm text-carbon/65">a week, delivered</small>
            </div>

            <div className="mt-4 border-t border-carbon text-[15px]">
              <div className="flex justify-between border-b border-soft-mist py-3">
                <span>Produce</span>
                <span className="tabular-nums">
                  <RollingNumber value={produce} format={formatNaira} />
                </span>
              </div>
              <div className="flex justify-between border-b border-soft-mist py-3">
                <span>Delivery</span>
                <span>
                  {delivery.isFree ? (
                    <span className="rounded-md bg-mint-pop px-1.5 py-0.5 font-semibold">Free</span>
                  ) : (
                    <span className="tabular-nums">{formatNaira(delivery.fee)}</span>
                  )}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {member && (
                  <motion.div
                    key="membership"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring.smooth}
                    className="overflow-hidden"
                  >
                    <div className="flex justify-between border-b border-soft-mist py-3">
                      <span>Membership, per week</span>
                      <span className="tabular-nums">{formatNaira(membershipWeekly)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <MagneticLink href={signedIn ? "/basket" : "/start"} className="mt-6 w-full" arrow>
              {signedIn ? "Open your basket" : "Build my basket"}
            </MagneticLink>
            <p className="mt-3 text-center text-[13px] text-carbon/60">
              {member && memberFee != null
                ? `Membership is ${formatNaira(memberFee)} a month. Cancel anytime.`
                : "Free to set up. Nothing is charged until you check out."}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
