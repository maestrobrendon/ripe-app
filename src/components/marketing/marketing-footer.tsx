"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { useSiteSettings } from "@/components/site-settings-provider";
import { supportHref, whatsappReady } from "@/lib/support";
import "@/app/(bare)/home-menu/home-menu.css";

/**
 * The footer every signed-out page shares with the homepage: a carbon block
 * with a rounded top, the links in columns, and the wordmark drawn huge along
 * the bottom, rising into place as the page scrolls to its end. Signed-in
 * members have Account > Help and info instead.
 */

const columns = (support: { whatsapp: string; email: string }): { title: string; links: [string, string][] }[] => [
  {
    title: "BasketNG",
    links: [
      ["Recipes", "/recipes"],
      ["Fruit & veg", "/shop"],
      ["How it works", "/#how"],
      ["Pricing", "/subscribe"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Delivery areas", "/delivery-areas"],
      ["Questions", "/faq"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
    ],
  },
  {
    title: "Help",
    links: [
      ...(whatsappReady(support) ? ([["WhatsApp us", supportHref(support)]] as [string, string][]) : []),
      [support.email, `mailto:${support.email}`],
      ["Your account", "/account"],
    ],
  },
];

const underline = "absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-paper-white transition-transform duration-(--dur-base) group-hover:scale-x-100";

export function MarketingFooter() {
  const { support } = useSiteSettings();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        gsap.from(".hm-footer-mark", {
          yPercent: 55,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom bottom", scrub: 0.6 },
        });
      });
    },
    { scope: ref },
  );

  return (
    <footer ref={ref} className="hm overflow-hidden rounded-t-[36px] bg-carbon pt-16 text-paper-white sm:rounded-t-[48px] sm:pt-20">
      {/* Phones: the blurb across the top, then the link columns two abreast. */}
      <div className="hm-wrap grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <p className="col-span-2 max-w-[22rem] text-[15px] leading-relaxed text-paper-white/65 lg:col-span-1">
          Fruit and vegetables, delivered across Lagos, sourced from farmers we know. Built for people who have already decided eating better is worth planning around.
        </p>
        {columns(support).map((c) => (
          <div key={c.title}>
            <h3 className="mb-3.5 text-[13px] font-semibold tracking-[0.06em] text-paper-white/55 uppercase">{c.title}</h3>
            <ul>
              {c.links.map(([label, href]) => (
                <li key={label} className="py-1.5 text-[15px]">
                  {href.startsWith("/") && !href.includes("#") ? (
                    <Link href={href} className="group relative">
                      {label}
                      <span className={underline} />
                    </Link>
                  ) : (
                    <a href={href} className="group relative" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {label}
                      <span className={underline} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hm-wrap mt-14 flex flex-wrap justify-between gap-2.5 border-t border-paper-white/15 pt-6 text-[13px] text-paper-white/55">
        <span>BasketNG, Lagos. {new Date().getFullYear()}.</span>
        <span>Made for people who train, cook and care.</span>
      </div>

      {/* The wordmark, bigger than the screen, clipped at the bottom edge. */}
      <div className="mt-8 overflow-hidden" aria-hidden>
        <p className="hm-footer-mark logo-wordmark -mb-[0.2em] text-center text-[27vw] leading-[0.8] text-paper-white">BasketNG</p>
      </div>
    </footer>
  );
}
