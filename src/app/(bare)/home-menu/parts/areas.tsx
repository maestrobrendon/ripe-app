"use client";

import Link from "next/link";
import { AreaCheck } from "@/components/areas/area-check";
import { DELIVERY_WINDOW } from "@/lib/delivery-labels";
import { MagneticLink, Reveal } from "../../home-next/parts/runtime";
import { Eyebrow } from "./shared";

/**
 * Where we deliver, between how it works and the price: the areas as stops
 * on a rider's route (a dashed line through a dot per area, the ones coming
 * next at the end, hollow), and a button that answers "do you come to me?"
 * in place. The full map is on /delivery-areas.
 */
export function Areas({
  areas,
  days,
  comingSoon,
  signedIn,
}: {
  areas: { slug: string; name: string; area: string }[];
  days: string;
  comingSoon: string[];
  signedIn: boolean;
}) {
  if (areas.length === 0) return null;
  const hours = DELIVERY_WINDOW.charAt(0).toUpperCase() + DELIVERY_WINDOW.slice(1);

  return (
    <section data-track-section="home-delivery-areas" id="areas" className="scroll-mt-20 py-12 sm:py-24">
      <div className="hm-wrap grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal className="min-w-0 lg:sticky lg:top-28">
          <Eyebrow className="text-[#0f7a48]">Delivery areas</Eyebrow>
          <h2 className="hm-h2">{days ? <>Across Lagos, {days}.</> : <>Across Lagos, every week.</>}</h2>
          <p className="hm-lede mt-4 max-w-[28rem]">{hours}, on the day you pick.</p>
          {/* From laptops up the check sits under the headline; on phones, under the list. */}
          <div className="mt-8 hidden lg:block">
            <Check signedIn={signedIn} />
          </div>
        </Reveal>

        <Reveal delay={0.08} className="min-w-0">
          <ol className="hm-panel relative p-3 sm:p-4" aria-label="Areas we deliver to">
            {/* The route: one dashed line behind every stop's dot. */}
            <span aria-hidden className="absolute top-9 bottom-9 left-[33px] border-l-2 border-dashed border-[#0f7a48]/25 sm:left-[37px]" />
            {areas.map((a) => (
              <li key={a.slug} className="relative flex items-start gap-4 rounded-[18px] px-3 py-3.5 sm:px-4">
                <span className="relative mt-1.5 grid h-4 w-4 shrink-0 place-items-center" aria-hidden>
                  <span className="hm-area-pulse absolute inset-0 rounded-full bg-mint-pop" />
                  <span className="relative h-3 w-3 rounded-full bg-[#0f7a48] ring-[3px] ring-[var(--hm-tint)]" />
                </span>
                <span className="min-w-0">
                  <b className="block text-[17px] leading-snug font-semibold tracking-[-0.02em]">{a.name}</b>
                  <span className="mt-0.5 block text-[14px] leading-snug text-[var(--hm-ink-2)]">{a.area}</span>
                </span>
              </li>
            ))}
            {comingSoon.map((name) => (
              <li key={name} className="relative flex items-center gap-4 rounded-[18px] px-3 py-3.5 sm:px-4">
                <span className="relative grid h-4 w-4 shrink-0 place-items-center" aria-hidden>
                  <span className="h-3 w-3 rounded-full border-2 border-[var(--hm-ink-3)] bg-[var(--hm-tint)]" />
                </span>
                <b className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--hm-ink-3)]">{name}</b>
                <span className="ml-auto rounded-full bg-paper-white px-2.5 py-1 text-[12px] font-semibold text-[var(--hm-ink-2)]">Coming soon</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 lg:hidden">
            <Check signedIn={signedIn} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Check({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <AreaCheck
        instead="Find your area in the list."
        yes={
          <MagneticLink href={signedIn ? "/basket" : "/start"} size="md" arrow>
            {signedIn ? "Open your basket" : "Try your first basket"}
          </MagneticLink>
        }
      />
      <Link href="/delivery-areas" className="mt-4 inline-block text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon max-lg:block max-lg:text-center">
        See them on a map
      </Link>
    </>
  );
}
