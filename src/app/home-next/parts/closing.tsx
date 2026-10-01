"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/site";
import { MagneticLink, Reveal } from "./runtime";
import { ProduceSticker } from "./produce";
import type { FarmProduct } from "../types";

/* -------------------------------------------------------------------------- */
/* Trial                                                                      */
/* -------------------------------------------------------------------------- */

const FLOATS = [
  { right: "6%", top: "12%", size: "w-36", r: -8 },
  { right: "20%", bottom: "10%", size: "w-28", r: 10 },
  { right: "24%", top: "8%", size: "w-20", r: -4 },
  { right: "3%", bottom: "14%", size: "w-20", r: 6 },
];

export function Trial({ stickers, signedIn }: { stickers: FarmProduct[]; signedIn: boolean }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        gsap.utils.toArray<HTMLElement>(".hn-float-inner").forEach((f, i) => {
          gsap.to(f, { y: -22 - i * 6, rotation: i % 2 ? 6 : -6, duration: 3 + i * 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        });
        gsap.to(".hn-float", {
          yPercent: -40,
          ease: "none",
          stagger: 0.05,
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} id="trial" className="bg-paper-white py-16 sm:py-24">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] sm:w-[min(1180px,calc(100%-48px))]">
        <div className="relative overflow-hidden rounded-[40px] border border-carbon bg-mint-pop p-[clamp(2rem,7vw,6rem)]">
          {stickers.slice(0, FLOATS.length).map((p, i) => {
            const f = FLOATS[i];
            return (
              <div
                key={p.id}
                aria-hidden
                className={`hn-float pointer-events-none absolute hidden lg:block ${f.size}`}
                style={{ right: f.right, top: f.top, bottom: f.bottom, rotate: `${f.r}deg` }}
              >
                <div className="hn-float-inner">
                  <ProduceSticker name={p.name} publicId={p.cloudinaryPublicId} emoji={p.imageEmoji} category={p.category} className="aspect-square w-full" sizes="150px" />
                </div>
              </div>
            );
          })}
          <div className="relative max-w-[46rem]">
            <Reveal>
              <h2 className="hn-display text-[clamp(2.4rem,4.4vw,4.2rem)]">
                <span className="block">Try one basket.</span>
                <span className="block">No strings.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-[32rem] text-lg leading-relaxed">
                Set it up for free and pick your day. You pay for the produce when you check out, at standard prices. No membership, no card saved,
                nothing that renews. Want it every week after that? Become a member and every basket after costs less.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <MagneticLink href={signedIn ? "/basket" : "/start"} variant="light" className="mt-8" arrow>
                {signedIn ? "Open your basket" : "Try a basket free"}
              </MagneticLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

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
  const [open, setOpen] = useState<number | null>(null);
  const names = zones.map((z) => z.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "selected Lagos areas";

  const items: { q: string; a: ReactNode }[] = [
    {
      q: "Where do you deliver?",
      a: (
        <>
          {list}, for now. Each area has fixed delivery days.
          {comingSoon.length > 0 && <> Coming next: {comingSoon.join(", ")}.</>} See the full list on the{" "}
          <Link href="/delivery-areas" className="underline underline-offset-2">
            delivery areas
          </Link>{" "}
          page.
        </>
      ),
    },
    {
      q: "How quickly will my order arrive?",
      a: <>Every area has fixed delivery days, with a 9am to 5pm window. A basket comes on the day you chose, every week. A one-off order comes on the next delivery day you pick at checkout.</>,
    },
    {
      q: "Is there a minimum order?",
      a: (
        <>
          No. Each product comes in a set pack size, greens by weight, oranges in pairs, and so on, so you only add what you need. Delivery is {formatNaira(deliveryFee)}, free once an order
          passes {formatNaira(freeDeliveryThreshold)}, and always free on member baskets.
        </>
      ),
    },
    {
      q: "What if something is not fresh?",
      a: (
        <>
          Every order is checked before it leaves us. If an item arrives damaged or not fresh, tell us within 24 hours on WhatsApp or by email with a photo of what you received, and we will look
          into it. Depending on what we find, that can mean a replacement, a credit, or a refund for that item.
        </>
      ),
    },
    {
      q: "What does trying a basket cost?",
      a: (
        <>
          Nothing to set up. You pay for the produce at standard prices when you check out, plus delivery unless the order passes {formatNaira(freeDeliveryThreshold)}. There is no membership, no
          card kept on file, and nothing renews on its own.
        </>
      ),
    },
    ...(memberFee != null
      ? [
          {
            q: "What does membership change?",
            a: (
              <>
                Membership is {formatNaira(memberFee)} a month. Members pay less for the produce, get free delivery on every basket, and can keep more than one basket going. Cancel anytime from your
                account.
              </>
            ),
          },
        ]
      : []),
  ];

  return (
    <section id="faq" className="bg-paper-white pb-28 sm:pb-36">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-10 sm:w-[min(1180px,calc(100%-48px))] lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <h2 className="hn-display text-[clamp(2.2rem,4vw,3.6rem)] lg:sticky lg:top-28">Before you order.</h2>
        </Reveal>
        <div className="border-t border-carbon">
          {items.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className="border-b border-carbon">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(on ? null : i)}
                  className="flex w-full items-center justify-between gap-5 py-6 text-left text-[clamp(1.05rem,1.6vw,1.2rem)] font-semibold"
                >
                  {f.q}
                  <motion.span
                    animate={{ rotate: on ? 45 : 0, backgroundColor: on ? "var(--mint-pop)" : "var(--soft-mist)" }}
                    transition={spring.snappy}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-carbon text-lg leading-none"
                    aria-hidden
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring.smooth}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[40rem] pb-6 text-base leading-relaxed text-carbon/75">{f.a}</p>
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
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Shop",
    links: [
      ["Fruits", "/fruits"],
      ["Boxes and baskets", "/boxes-baskets"],
      ["Fresh cuts", "/fresh-cuts"],
      ["Recipes", "/recipes"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Membership", "/subscribe"],
      ["About", "/about"],
      ["Delivery areas", "/delivery-areas"],
      ["Questions", "/faq"],
    ],
  },
  {
    title: "Support",
    links: [
      [SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`],
      ["WhatsApp us", `https://wa.me/${SUPPORT_WHATSAPP}`],
      ["Your account", "/account"],
      ["Terms", "/terms"],
    ],
  },
];

export function Footer() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        gsap.from(".hn-wordmark", {
          yPercent: 55,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom bottom", scrub: 0.6 },
        });
      });
    },
    { scope: ref },
  );

  return (
    <footer ref={ref} id="footer" data-nav-dark className="overflow-hidden rounded-t-[48px] bg-carbon pt-20 text-paper-white">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-10 sm:w-[min(1180px,calc(100%-48px))] sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="max-w-[22rem] text-[15px] leading-relaxed text-paper-white/65">
            Fruit and vegetables, delivered across Lagos, sourced from farmers we know. Built for people who have already decided eating better is worth planning around.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h5 className="mb-3.5 text-[13px] font-semibold tracking-[0.06em] text-paper-white/55 uppercase">{c.title}</h5>
            <ul>
              {c.links.map(([label, href]) => (
                <li key={label} className="py-1.5 text-[15px]">
                  {href.startsWith("/") ? (
                    <Link href={href} className="group relative">
                      {label}
                      <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-paper-white transition-transform duration-(--dur-base) group-hover:scale-x-100" />
                    </Link>
                  ) : (
                    <a href={href} className="group relative" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {label}
                      <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-paper-white transition-transform duration-(--dur-base) group-hover:scale-x-100" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 flex w-[min(1180px,calc(100%-32px))] flex-wrap justify-between gap-2.5 border-t border-paper-white/15 pt-6 text-[13px] text-paper-white/55 sm:w-[min(1180px,calc(100%-48px))]">
        <span>Basket, Lagos. {new Date().getFullYear()}.</span>
        <span>Made for people who train, cook and care.</span>
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          Photography from Pexels
        </a>
      </div>

      <div className="mt-8 overflow-hidden" aria-hidden>
        <p className="hn-wordmark logo-wordmark -mb-[0.2em] text-center text-[27vw] leading-[0.8] text-paper-white">Basket</p>
      </div>
    </footer>
  );
}
