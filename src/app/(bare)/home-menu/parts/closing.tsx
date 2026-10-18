"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { useSupportVerb, useWhatsappHref } from "@/components/support-links";
import { MagneticLink, Reveal } from "../../home-next/parts/runtime";
import { AvocadoHalf, Bowl, Carrot, Chilli, LimeSlice, Mushroom, Sparkle, Tomato, INK } from "./art";
import { Eyebrow } from "./shared";

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export function Faq({
  zones,
  comingSoon,
  memberFee,
}: {
  zones: { name: string; days: string[] }[];
  comingSoon: string[];
  memberFee: number | null;
}) {
  const whatsapp = useWhatsappHref();
  const verb = useSupportVerb();
  const [open, setOpen] = useState<number | null>(0);
  const names = zones.map((z) => z.name);
  const days = [...new Set(zones.flatMap((z) => z.days))];
  const dayList = days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}` : days[0] ?? "";
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "selected Lagos areas";

  const items: { q: string; a: ReactNode }[] = [
    {
      q: "How does a basket work?",
      a: (
        <>
          Your basket is the fruit and vegetables you want each week, and it stays as you left it. A few days before each delivery we remind you on WhatsApp, email and the app to
          confirm it. You pay when it arrives, or by transfer. Nothing is ever charged automatically, and a week you don&apos;t confirm simply doesn&apos;t come.
        </>
      ),
    },
    {
      q: "Can I try it first?",
      a: (
        <>
          Yes. Your first basket is a trial: one delivery at market prices, no membership needed. To have it every week, or to run more than one basket, like one for you and one
          for your mum, become a member.
        </>
      ),
    },
    {
      q: "Why are member prices so low?",
      a: (
        <>
          Membership is how we make our money, so members pay close to what we pay at the market. Everyone else pays the market rate. We buy straight from the farms and growers we
          work with, so there are fewer hands between the farm and your kitchen.
        </>
      ),
    },
    {
      q: "Do I have to cook?",
      a: (
        <>
          No. Plenty of people just want good fruit, and that&apos;s welcome. The recipes are there to make fruit and veg exciting to eat: salads, bowls, snacks and sides. Cook
          all of them, some of them, or none.
        </>
      ),
    },
    {
      q: "Can I skip a week or pause?",
      a: <>Yes. Skip any week until the evening before, pause a basket while you&apos;re away, and change its day or what&apos;s in it whenever you like.</>,
    },
    {
      q: "What about the ingredients you don't sell?",
      a: (
        <>
          Every recipe marks them clearly as &ldquo;grab it elsewhere&rdquo;. It is usually the protein, a grain or a cheese, around one in five ingredients, so the shopping list stays short.
          Basics like oil and salt are assumed.
        </>
      ),
    },
    {
      q: "Is Kachi a nutritionist?",
      a: <>No. Kachi plans food: recipes, portions for your household, and the basket to match. It doesn&apos;t give medical advice. If you have a condition or a prescribed diet, follow your doctor first.</>,
    },
    {
      q: "Where do you deliver?",
      a: (
        <>
          {list}, for now{dayList ? <>, on {dayList}</> : null}, between 9am and 5pm.
          {comingSoon.length > 0 && <> Coming next: {comingSoon.join(", ")}.</>} See the{" "}
          <Link href="/delivery-areas" className="underline underline-offset-2">
            delivery areas
          </Link>{" "}
          page for the full list.
        </>
      ),
    },
    {
      q: "Is there a minimum order?",
      a: (
        <>
          No. Delivery depends on your area: each one has its own fee, shown before you pay, and it&apos;s free on Member Plus.
          {memberFee != null && <> Membership starts at {formatNaira(memberFee)} a month, brings member prices on every basket, and you can cancel anytime from your account.</>}
        </>
      ),
    },
    {
      q: "What if something isn't fresh?",
      a: (
        <>
          Tell us within 7 days from your order page, with a photo of what arrived. Depending on what we find, that means a replacement, a credit, or a refund for that item.
        </>
      ),
    },
  ];

  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-24">
      <div className="hm-wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <Eyebrow className="text-electric-blue">Questions</Eyebrow>
            <h2 className="hm-h2">Before your first basket.</h2>
            <p className="hm-lede mt-4">
              Anything else?{" "}
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold text-carbon underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
                {verb}
              </a>
              .
            </p>
          </div>
        </Reveal>
        <div className="space-y-2">
          {items.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className="rounded-[22px] bg-[#f3f5f0] transition-colors">
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left text-[16px] font-semibold tracking-[-0.015em] sm:px-6">
                  {f.q}
                  <motion.span animate={{ rotate: on ? 45 : 0 }} transition={spring.snappy} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-white text-lg leading-none" aria-hidden>
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.smooth} className="overflow-hidden">
                      <p className="max-w-[40rem] px-5 pb-6 text-[15px] leading-relaxed text-[var(--hm-ink-2)] sm:px-6">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing                                                                    */
/* -------------------------------------------------------------------------- */

/** The produce that tumbles into the bowl, as % of the scene. */
const DROPS = [
  { Art: Tomato, left: "6%", top: "8%", w: "16%", r: -10 },
  { Art: AvocadoHalf, left: "74%", top: "0%", w: "18%", r: 14 },
  { Art: Chilli, left: "26%", top: "-6%", w: "15%", r: -20 },
  { Art: LimeSlice, left: "58%", top: "12%", w: "12%", r: 0 },
  { Art: Carrot, left: "84%", top: "38%", w: "15%", r: 30 },
  { Art: Mushroom, left: "-2%", top: "44%", w: "13%", r: -8 },
];

export function Closing({ signedIn }: { signedIn: boolean }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: "top 75%", once: true } });
        tl.from(".hm-bowl", { y: 50, autoAlpha: 0, duration: 0.9, ease: "back.out(1.4)" })
          .from(".hm-drop", { y: -140, autoAlpha: 0, rotation: () => gsap.utils.random(-60, 60), duration: 1, ease: "bounce.out", stagger: 0.08 }, 0.2)
          .from(".hm-spark", { scale: 0, autoAlpha: 0, duration: 0.5, ease: "back.out(2)", stagger: 0.1 }, 0.9);
        gsap.utils.toArray<HTMLElement>(".hm-drop-inner").forEach((el, i) => {
          gsap.to(el, { y: -8 - (i % 3) * 3, duration: 2.4 + (i % 3) * 0.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.6 });
        });
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="pt-8 pb-20 sm:pb-28">
      <div className="hm-wrap">
        <div className="grid items-center gap-10 overflow-hidden rounded-[36px] bg-[#f3f5f0] p-8 sm:p-12 md:grid-cols-[1fr_1fr] lg:p-16">
          <div>
            <h2 className="hm-h2">Start with a trial basket.</h2>
            <p className="hm-lede mt-4 max-w-[26rem]">Pick your fruit and veg, pick your day, and pay when it arrives. No membership needed for your first one.</p>
            <div className="mt-8">
              <MagneticLink href={signedIn ? "/basket" : "/start"} arrow>
                {signedIn ? "Open your basket" : "Get started"}
              </MagneticLink>
            </div>
          </div>
          <div className="relative mx-auto aspect-[10/8] w-full max-w-[460px]" aria-hidden>
            <Bowl className="hm-bowl absolute bottom-0 left-[10%] w-[80%]" />
            {DROPS.map(({ Art, left, top, w, r }, i) => (
              <div key={i} className="hm-drop absolute" style={{ left, top, width: w, rotate: `${r}deg` }}>
                <div className="hm-drop-inner">
                  <Art className="h-auto w-full drop-shadow-[0_10px_10px_rgb(0_0_0/0.1)]" />
                </div>
              </div>
            ))}
            <Sparkle color={INK.sun} className="hm-spark absolute top-[34%] left-[44%] w-[6%]" />
            <Sparkle color={INK.violet} className="hm-spark absolute top-[4%] left-[50%] w-[4%]" />
            <Sparkle color={INK.mint} className="hm-spark absolute top-[30%] left-[18%] w-[4.5%]" />
          </div>
        </div>
      </div>
    </section>
  );
}
