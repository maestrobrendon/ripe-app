"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { MagneticLink, Reveal, setScrollLocked } from "../../home-next/parts/runtime";
import { MENU_GOALS, type MenuGoal, type MenuRecipe } from "../recipes";
import { useMenu } from "@/components/menu-provider";
import type { MenuProduct } from "../types";
import { Check, Clock, Eyebrow, IngredientChip, People, ShareMeter, splitRecipe } from "./shared";

export function Menu({
  goal,
  onGoal,
  products,
  signedIn,
}: {
  goal: MenuGoal;
  onGoal: (g: MenuGoal) => void;
  products: Record<string, MenuProduct>;
  signedIn: boolean;
}) {
  const MENU = useMenu();
  const [open, setOpen] = useState<MenuRecipe | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const recipes = MENU.filter((r) => r.goal === goal);
  const trio = recipes.length >= 3;

  return (
    <section id="menu" className="scroll-mt-20 py-12 sm:py-24">
      <div className="hm-wrap">
        <div>
          <Reveal className="max-w-[44rem]">
            <Eyebrow>This week&apos;s recipes</Eyebrow>
            <h2 className="hm-h2">So none of it sits in the fridge.</h2>
            <p className="hm-lede mt-4">Every week, recipes built from what&apos;s in your basket. Pick your goal and the menu follows.</p>
          </Reveal>

          <LayoutGroup id="hm-goal">
            <div className="-mx-4 mt-8 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist" aria-label="Recipes for">
              {MENU_GOALS.map((g) => {
                const on = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="hm-menu-grid"
                    onClick={() => onGoal(g.id)}
                    className={`relative h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${on ? "text-paper-white" : "text-carbon/65 hover:text-carbon"}`}
                  >
                    {on && <motion.span layoutId="hm-goal-pill" transition={spring.indicator} className="absolute inset-0 rounded-full bg-carbon" />}
                    <span className="relative">{g.short}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        {/* Three or more: one large card and a stack beside it. Fewer: equal
            cards side by side. On phones, a rail (see .hm-rail). */}
        <div
          id="hm-menu-grid"
          role="tabpanel"
          className={`hm-rail mt-6 md:grid md:gap-5 ${trio ? "md:grid-cols-[1.25fr_1fr] md:grid-rows-2" : "md:grid-cols-2"}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {recipes.map((r, i) => (
              <motion.div
                key={r.slug}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ ...spring.smooth, delay: i * 0.05 }}
                className={trio && i === 0 ? "md:row-span-2" : ""}
              >
                <RecipeCard recipe={r} products={products} large={!trio || i === 0} tall={trio && i === 0} onOpen={() => setOpen(r)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-[#f3f5f0] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
            <span className="inline-flex items-center gap-2">
              <i className="h-2 w-5 rounded-full bg-mint-pop" aria-hidden /> In your basket
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="h-2 w-5 rounded-full border-[1.5px] border-ember" aria-hidden /> Grab it elsewhere
            </span>
          </div>
          <Link href="/recipes" className="text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
            See every recipe
          </Link>
        </div>
      </div>

      <RecipeSheet recipe={open} products={products} signedIn={signedIn} onClose={close} />
    </section>
  );
}

/** tall: the lead card of three, whose photo fills the height of the stack beside it. Others keep their own ratio. */
function RecipeCard({ recipe, products, large, tall = false, onOpen }: { recipe: MenuRecipe; products: Record<string, MenuProduct>; large: boolean; tall?: boolean; onOpen: () => void }) {
  const { basket, total } = splitRecipe(recipe, products);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group hm-photo flex h-full w-full flex-col overflow-hidden rounded-[26px] bg-[#f3f5f0] text-left"
      aria-label={`${recipe.title}. ${basket.length} of ${total} ingredients from your basket. Open the recipe.`}
    >
      <div className={`relative w-full overflow-hidden ${tall ? "aspect-[4/3] md:aspect-auto md:min-h-[280px] md:flex-1" : large ? "aspect-[4/3]" : "aspect-[16/9]"}`}>
        <Image src={recipe.image} alt={recipe.alt} fill sizes={large ? "(min-width: 768px) 600px, 100vw" : "(min-width: 768px) 480px, 100vw"} className="object-cover" />
        <span className="absolute top-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-paper-white/92 px-3 text-[13px] font-semibold backdrop-blur-sm">
          <Clock className="h-4 w-4" />
          {recipe.minutes} min
        </span>
      </div>
      <div className={`flex flex-col gap-3 ${large ? "p-6 sm:p-7" : "p-5"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={large ? "hm-h3" : "text-[17px] leading-snug font-semibold tracking-[-0.02em]"}>{recipe.title}</h3>
            {large && <p className="mt-2 hidden text-[15px] leading-relaxed text-[var(--hm-ink-2)] md:block">{recipe.hook}</p>}
          </div>
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-white transition-transform duration-(--dur-base) group-hover:rotate-45" aria-hidden>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </span>
        </div>
        <div>
          <ShareMeter have={basket.length} total={total} />
          <p className="mt-2 text-[13px] font-medium text-[var(--hm-ink-2)]">
            <b className="font-semibold text-carbon">
              {basket.length} of {total}
            </b>{" "}
            ingredients in your basket
          </p>
        </div>
      </div>
    </button>
  );
}

/** The full recipe, as a sheet from the bottom on phones and a centred panel above. */
function RecipeSheet({ recipe, products, signedIn, onClose }: { recipe: MenuRecipe | null; products: Record<string, MenuProduct>; signedIn: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(Boolean(recipe));

  useEffect(() => {
    if (!recipe) return;
    setScrollLocked(true);
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      setScrollLocked(false);
      opener?.focus();
    };
  }, [recipe, onClose]);

  const split = recipe ? splitRecipe(recipe, products) : null;

  return (
    <AnimatePresence>
      {recipe && split && (
        <motion.div key="hm-sheet" className="fixed inset-0 z-(--z-dialog) flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Close the recipe"
            className="absolute inset-0 bg-carbon/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hm-sheet-title"
            data-lenis-prevent
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={spring.sheet}
            className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-[28px] bg-paper-white sm:max-w-[880px] sm:rounded-[28px]"
          >
            <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
              <div className="relative aspect-[16/10] sm:sticky sm:top-0 sm:aspect-auto sm:h-full sm:max-h-[92svh] sm:min-h-[560px]">
                <Image src={recipe.image} alt={recipe.alt} fill sizes="(min-width: 640px) 400px, 100vw" className="object-cover" />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <h3 id="hm-sheet-title" className="hm-h3 text-[1.6rem]!">
                    {recipe.title}
                  </h3>
                  <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the recipe" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f3f5f0] hover:bg-[#e8ede3]">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--hm-ink-2)]">{recipe.hook}</p>
                <div className="mt-4 flex gap-2 text-[13px] font-semibold">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#f3f5f0] px-3">
                    <Clock className="h-4 w-4" /> {recipe.minutes} min
                  </span>
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#f3f5f0] px-3">
                    <People className="h-4 w-4" /> Serves {recipe.serves}
                  </span>
                </div>

                <div className="mt-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="text-[15px] font-semibold">In your basket</h4>
                    <span className="text-[13px] text-[var(--hm-ink-2)]">
                      {split.basket.length} of {split.total}
                    </span>
                  </div>
                  <ShareMeter have={split.basket.length} total={split.total} className="mt-2.5" animate={false} />
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {split.basket.map((p) => (
                      <IngredientChip key={p.slug} product={p} size="sm" />
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-[15px] font-semibold">Grab it elsewhere</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {split.elsewhere.map((e) => (
                      <IngredientChip key={e} label={e} size="sm" />
                    ))}
                  </div>
                  <p className="mt-2.5 text-[13px] text-[var(--hm-ink-3)]">Plus the basics you already have: oil, salt and pepper.</p>
                </div>

                <div className="mt-7">
                  <h4 className="text-[15px] font-semibold">How to make it</h4>
                  {recipe.membersOnly && recipe.steps.length === 0 && (
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--hm-ink-2)]">
                      The method for this one is for members, with amounts for every ingredient.{" "}
                      <Link href="/subscribe" className="font-semibold text-carbon underline underline-offset-4">
                        See membership
                      </Link>
                    </p>
                  )}
                  <ol className="mt-3 space-y-3">
                    {recipe.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-pop text-[12px] font-bold">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-8 flex flex-col gap-3 border-t border-[var(--hm-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-[14px] text-[var(--hm-ink-2)]">
                    <Check className="h-4 w-4 text-[#0f7a48]" /> Kachi can put this in your plan.
                  </p>
                  <MagneticLink href={signedIn ? "/recipes" : `/start?goal=${recipe.goal}&recipe=${recipe.slug}`} size="md" arrow>
                    {signedIn ? "Add to my plan" : "Start with this recipe"}
                  </MagneticLink>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
