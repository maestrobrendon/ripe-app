"use client";

import Link from "next/link";
import { useSiteSettings } from "@/components/site-settings-provider";
import { supportHref, whatsappReady } from "@/lib/support";
import "@/app/(bare)/home-menu/home-menu.css";

/**
 * The footer every signed-out page shares with the homepage. Signed-in
 * members have Account > Help and info instead.
 */

const columns = (support: { whatsapp: string; email: string }): { title: string; links: [string, string][] }[] => [
  {
    title: "Basket",
    links: [
      ["Recipes", "/recipes"],
      ["Fruits", "/shop"],
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

export function MarketingFooter() {
  const { support } = useSiteSettings();
  return (
    <footer className="hm border-t border-[var(--hm-line)] py-14">
      <div className="hm-wrap grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="logo-wordmark text-[24px] leading-none">
            Basket
          </Link>
          <p className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-[var(--hm-ink-3)]">Recipes and fresh produce for whatever you&apos;re working toward. Lagos.</p>
        </div>
        {columns(support).map((c) => (
          <div key={c.title}>
            <h3 className="text-[14px] font-semibold">{c.title}</h3>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label} className="text-[14px] text-[var(--hm-ink-2)]">
                  {href.startsWith("/") && !href.includes("#") ? (
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
