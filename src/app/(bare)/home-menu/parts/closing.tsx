"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/site";
import { MagneticLink, Reveal } from "../../home-next/parts/runtime";
import { AvocadoHalf, Bowl, Carrot, Chilli, LimeSlice, Mushroom, Sparkle, Tomato, INK } from "./art";
import { Eyebrow } from "./shared";

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export function Faq({
  zones,
  comingSoon,
  deliveryFee,
  freeDeliveryThreshold,
  memberFee,
}: {
  zones: { name: string; days: string[] }[];
  comingSoon: string[];
  deliveryFee: number;
  freeDeliveryThreshold: number;
  memberFee: number | null;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const names = zones.map((z) => z.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "selected Lagos areas";

  const items: { q: string; a: ReactNode }[] = [
    {
      q: "How are your prices this good?",
      a: (
        <>
          We buy straight from the farms and growers we work with, not off a warehouse shelf. Fewer hands between the farm and your kitchen means fairer prices and produce
          that is fresher when it reaches you.
        </>
      ),
    },
    {
      q: "Do I have to cook every recipe?",
      a: <>No. The recipes are suggestions built around your basket. Cook all of them, some of them, or none, and swap any recipe in your plan for another in a tap.</>,
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
      a: <>No. Kachi plans food: recipes, portions for your household, and the basket to match. She does not give medical advice. If you have a condition or a prescribed diet, follow your doctor first.</>,
    },
    {
      q: "Where do you deliver?",
      a: (
        <>
          {list}, for now. Each area has fixed delivery days, with a 9am to 5pm window.
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
          No. Delivery is {formatNaira(deliveryFee)}, free once an order passes {formatNaira(freeDeliveryThreshold)}, and always free on member baskets.
          {memberFee != null && <> Membership is {formatNaira(memberFee)} a month, makes every basket cheaper, and you can cancel anytime from your account.</>}
        </>
      ),
    },
    {
      q: "What if something isn't fresh?",
      a: (
        <>
          Tell us within 24 hours on WhatsApp or by email, with a photo of what arrived. Depending on what we find, that means a replacement, a credit, or a refund for that item.
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
              <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-carbon underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
                Message us on WhatsApp
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
            <h2 className="hm-h2">Start with one basket.</h2>
            <p className="hm-lede mt-4 max-w-[26rem]">Tell Kachi your goal, pick your day, and cook your first recipe this week. Free to set up.</p>
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

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Basket",
    links: [
      ["Recipes", "/recipes"],
      ["Fruits", "/fruits"],
      ["Boxes and baskets", "/boxes-baskets"],
      ["Membership", "/subscribe"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Delivery areas", "/delivery-areas"],
      ["Questions", "/faq"],
      ["Terms", "/terms"],
    ],
  },
  {
    title: "Help",
    links: [
      ["WhatsApp us", `https://wa.me/${SUPPORT_WHATSAPP}`],
      [SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`],
      ["Your account", "/account"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--hm-line)] py-14">
      <div className="hm-wrap grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="logo-wordmark text-[24px] leading-none">
            Basket
          </Link>
          <p className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-[var(--hm-ink-3)]">Recipes and fresh produce for whatever you&apos;re working toward. Lagos.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h3 className="text-[14px] font-semibold">{c.title}</h3>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label} className="text-[14px] text-[var(--hm-ink-2)]">
                  {href.startsWith("/") ? (
                    <Link href={href} className="hover:text-carbon">
                      {label}
                    </Link>
                  ) : (
                    <a href={href} className="hover:text-carbon" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="hm-wrap mt-12 flex flex-wrap justify-between gap-2 text-[13px] text-[var(--hm-ink-3)]">
        <span>© {new Date().getFullYear()} Basket</span>
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="hover:text-carbon">
          Food photography from Pexels
        </a>
      </div>
    </footer>
  );
}
