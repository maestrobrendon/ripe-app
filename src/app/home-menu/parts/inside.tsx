"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { Reveal } from "../../home-next/parts/runtime";
import { MENU } from "../recipes";
import type { MenuProduct } from "../types";
import { Check, Eyebrow, IngredientChip, ShareMeter, localName, shortName, splitRecipe } from "./shared";

/** Where the ingredient chips pin onto the photo, as % of the frame. */
const PINS = [
  { left: "-6%", top: "10%" },
  { left: "58%", top: "4%" },
  { left: "-8%", top: "44%" },
  { left: "64%", top: "36%" },
  { left: "4%", top: "78%" },
  { left: "56%", top: "84%" },
];

export function Inside({ products }: { products: Record<string, MenuProduct> }) {
  const recipe = MENU.find((r) => r.slug === "sweet-potato-burrito-bowl") ?? MENU[0];
  const { basket, elsewhere, total } = splitRecipe(recipe, products);
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        // The chips fly out of the bowl to their places as the photo arrives.
        gsap.from(".hm-pin", {
          x: (i, el) => {
            const host = (el as HTMLElement).parentElement!.getBoundingClientRect();
            const r = (el as HTMLElement).getBoundingClientRect();
            return host.left + host.width / 2 - (r.left + r.width / 2);
          },
          y: (i, el) => {
            const host = (el as HTMLElement).parentElement!.getBoundingClientRect();
            const r = (el as HTMLElement).getBoundingClientRect();
            return host.top + host.height / 2 - (r.top + r.height / 2);
          },
          scale: 0.3,
          autoAlpha: 0,
          duration: 1,
          ease: "back.out(1.3)",
          stagger: 0.08,
          scrollTrigger: { trigger: ".hm-inside-photo", start: "top 70%", once: true },
        });
        gsap.fromTo(".hm-inside-photo img", { scale: 1.12 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".hm-inside-photo", start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="inside" className="py-16 sm:py-24">
      <div className="hm-wrap grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div className="relative mx-auto w-full max-w-[460px] px-6 sm:px-10 lg:max-w-none">
          <div className="hm-inside-photo relative aspect-[4/5] overflow-hidden rounded-[32px]">
            <Image src={recipe.image} alt={recipe.alt} fill sizes="(min-width: 1024px) 480px, 90vw" className="object-cover" />
          </div>
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {basket.slice(0, PINS.length).map((p, i) => (
              <div key={p.slug} className="hm-pin absolute" style={PINS[i]}>
                <div className="shadow-[0_12px_24px_-12px_rgb(0_0_0/0.35)] rounded-full">
                  <IngredientChip product={p} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Reveal>
            <Eyebrow className="text-ember">Inside every recipe</Eyebrow>
            <h2 className="hm-h2">Most of the recipe is already in your basket.</h2>
            <p className="hm-lede mt-4 max-w-[30rem]">
              Every recipe is built around the produce we send, so around four in five ingredients arrive at your door. The rest we flag clearly, so your shopping list is short and you know exactly what it is.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 rounded-[24px] bg-[#f3f5f0] p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[15px] font-semibold">{recipe.title}</p>
              <p className="text-[14px] text-[var(--hm-ink-2)]">
                <b className="font-semibold text-carbon">
                  {basket.length} of {total}
                </b>{" "}
                from Basket
              </p>
            </div>
            <ShareMeter have={basket.length} total={total} className="mt-3" />
            <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {basket.map((p) => (
                <li key={p.slug} className="flex items-center gap-2.5 text-[15px]">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-pop">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>
                    {shortName(p.name)}
                    {localName(p.name) && <span className="text-[var(--hm-ink-3)]"> ({localName(p.name)})</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-[var(--hm-line)] pt-4">
              <p className="text-[13px] font-semibold text-ember">Grab it elsewhere</p>
              <ul className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {elsewhere.map((e) => (
                  <li key={e} className="flex items-center gap-2.5 text-[15px]">
                    <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-dashed border-ember" aria-hidden />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
