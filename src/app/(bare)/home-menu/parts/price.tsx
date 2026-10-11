"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { buildStarterPicks, type StarterCandidate } from "@/lib/starter-basket-core";
import { RollingNumber } from "@/components/ui/rolling-number";
import { ProductImage } from "@/components/product-image";
import { MagneticLink, Reveal } from "../../home-next/parts/runtime";
import { MENU_GOALS, type MenuGoal } from "../recipes";
import { Eyebrow, shortName } from "./shared";

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const btn = "grid h-9 w-9 place-items-center rounded-full bg-paper-white text-lg leading-none font-semibold disabled:opacity-35 active:scale-95 transition-transform";
  return (
    <div className="flex h-14 items-center justify-between rounded-[18px] bg-[#f3f5f0] pr-2 pl-4">
      <span className="text-[15px] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
          −
        </button>
        <RollingNumber value={value} className="min-w-5 justify-center text-center font-semibold" />
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
          +
        </button>
      </div>
    </div>
  );
}

export function Price({
  goal,
  onGoal,
  candidates,
  memberFee,
  freeDeliveryThreshold,
  signedIn,
}: {
  goal: MenuGoal;
  onGoal: (g: MenuGoal) => void;
  candidates: StarterCandidate[];
  memberFee: number | null;
  freeDeliveryThreshold: number;
  signedIn: boolean;
}) {
  const [member, setMember] = useState(false);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const isMember = member && memberFee != null;
  const starterSlug = MENU_GOALS.find((g) => g.id === goal)?.starterSlug ?? null;

  // The same starter logic sign-up uses, so the number here is the number they get.
  const picks = useMemo(
    () => buildStarterPicks({ goalSlug: starterSlug, producePreferences: [], adults, kids }, candidates),
    [starterSlug, adults, kids, candidates],
  );
  const produce = picks.reduce((s, p) => s + (isMember ? p.memberPrice : p.standardPrice) * p.quantity, 0);
  const delivery = quoteDelivery(produce, isMember);
  const membershipWeekly = isMember && memberFee ? Math.round((memberFee * 12) / 52) : 0;
  const total = produce + delivery.fee + membershipWeekly;

  return (
    <section id="price" className="scroll-mt-20 py-16 sm:py-24">
      <div className="hm-wrap grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Eyebrow className="text-[#0f7a48]">Pricing</Eyebrow>
          <h2 className="hm-h2">What a week of eating well costs.</h2>
          <p className="hm-lede mt-4 max-w-[30rem]">
            Pick a goal and your household and see the real number. No minimum order. Delivery is free on member baskets, and on any order over {formatNaira(freeDeliveryThreshold)}.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Your goal">
            {MENU_GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={goal === g.id}
                onClick={() => onGoal(g.id)}
                className={`h-10 rounded-full px-4 text-[14px] font-semibold transition-colors ${goal === g.id ? "bg-carbon text-paper-white" : "bg-[#f3f5f0] text-carbon/70 hover:text-carbon"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-[32px] bg-paper-white p-5 shadow-[0_0_0_1px_var(--hm-line),0_30px_60px_-40px_rgb(0_0_0/0.35)] sm:p-7">
            {memberFee != null && (
              <LayoutGroup id="hm-plan">
                <div className="flex rounded-full bg-[#f3f5f0] p-1" role="radiogroup" aria-label="How you pay">
                  {(
                    [
                      [false, "One basket"],
                      [true, "As a member"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={member === k}
                      onClick={() => setMember(k)}
                      className={`relative h-10 flex-1 rounded-full text-[14px] font-semibold transition-colors ${member === k ? "text-paper-white" : "text-carbon/65"}`}
                    >
                      {member === k && <motion.span layoutId="hm-plan-pill" transition={spring.indicator} className="absolute inset-0 rounded-full bg-carbon" />}
                      <span className="relative">{label}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            )}

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <Stepper label="Adults" value={adults} min={1} max={8} onChange={setAdults} />
              <Stepper label="Children" value={kids} min={0} max={8} onChange={setKids} />
            </div>

            <div className="mt-7 flex items-baseline justify-between gap-4">
              <RollingNumber value={total} format={formatNaira} className="text-[clamp(2.4rem,5vw,3rem)] leading-none font-semibold tracking-[-0.045em] tabular-nums" />
              <span className="text-[14px] text-[var(--hm-ink-2)]">a week, delivered</span>
            </div>

            <div className="mt-5 text-[15px]">
              <div className="flex justify-between border-t border-[var(--hm-line)] py-3">
                <span>Produce, {picks.length} items</span>
                <RollingNumber value={produce} format={formatNaira} className="tabular-nums" />
              </div>
              <div className="flex justify-between border-t border-[var(--hm-line)] py-3">
                <span>Delivery</span>
                {delivery.isFree ? <span className="rounded-full bg-mint-pop px-2.5 py-0.5 text-[13px] font-semibold">Free</span> : <span className="tabular-nums">{formatNaira(delivery.fee)}</span>}
              </div>
              <AnimatePresence initial={false}>
                {isMember && (
                  <motion.div key="m" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.smooth} className="overflow-hidden">
                    <div className="flex justify-between border-t border-[var(--hm-line)] py-3">
                      <span>Membership, per week</span>
                      <span className="tabular-nums">{formatNaira(membershipWeekly)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="What would be in it">
              <AnimatePresence initial={false} mode="popLayout">
                {picks.map((p) => (
                  <motion.span
                    key={p.productId}
                    layout
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={spring.juicy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#f3f5f0] py-1 pr-3 pl-1 text-[13px] font-medium"
                  >
                    <ProductImage publicId={p.cloudinaryPublicId} alt="" emoji={p.imageEmoji} sizes="24px" rounded="rounded-full" flavour="bg-paper-white" emojiClassName="text-xs" className="h-6 w-6" />
                    {shortName(p.name)}
                    <b className="font-semibold tabular-nums">×{p.quantity}</b>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>

            <MagneticLink href={signedIn ? "/basket" : `/start?goal=${goal}`} className="mt-6 w-full" arrow>
              {signedIn ? "Open your basket" : "Build my basket"}
            </MagneticLink>
            <p className="mt-3 text-center text-[13px] text-[var(--hm-ink-3)]">
              {isMember && memberFee != null ? `Membership is ${formatNaira(memberFee)} a month. Cancel anytime.` : "Free to set up. Nothing is charged until you check out."}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
