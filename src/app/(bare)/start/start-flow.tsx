"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { DELIVERY_DAY_LABEL, formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import type { StarterCandidate } from "@/lib/starter-basket-core";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { KachiMark } from "@/components/kachi-mark";
import { ProductImage } from "@/components/product-image";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Icon } from "@/components/ui/icon";
import { MENU, MENU_GOALS, type MenuGoal, type MenuRecipe } from "../home-menu/recipes";
import { shortName } from "../home-menu/parts/shared";
import { buildRecipeBasket, snapQuantity } from "./recipe-basket";
import { createAccountFromOnboarding, type StartState } from "./actions";

type Zone = { slug: string; name: string; area: string; isServed: boolean; deliveryDays: DeliveryDay[] };
type Dietary = "none" | "vegetarian" | "vegan" | "allergies";

/**
 * Sign-up, as the homepage promises it: say where you are, tell Kachi your
 * goal, get a week of recipes and the basket to cook them, pick your day.
 * Short screens, one question each, with the answer that unlocks the next one
 * always in reach of a thumb at the bottom. The account comes last, after the
 * customer has seen what they are getting.
 *
 * Area comes first so nobody builds a basket before learning we don't reach
 * them yet; the day waits until after the basket, where it means something,
 * and only offers that area's days. Outside our areas, the day is skipped.
 */
const STEPS = ["area", "goal", "table", "recipes", "basket", "day", "account"] as const;
type Step = (typeof STEPS)[number];

const DIETARY: [Dietary, string][] = [
  ["none", "No restrictions"],
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["allergies", "Allergies or dislikes"],
];

const DAY_INDEX: Record<DeliveryDay, number> = { MONDAY: 1, WEDNESDAY: 3, FRIDAY: 5 };

/** The first delivery on that weekday at least two days out, so the night-before cutoff has passed for nobody. */
function firstDelivery(day: DeliveryDay) {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() !== DAY_INDEX[day]) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "Monday, Wednesday and Friday". */
function listDays(days: DeliveryDay[]) {
  const names = days.map((d) => DELIVERY_DAY_LABEL[d] ?? d);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

const goalLabel = (g: MenuGoal | null) => MENU_GOALS.find((x) => x.id === g)?.label ?? "";
/** The goal as it reads mid-sentence: "three for eating lighter". */
const GOAL_PHRASE: Record<MenuGoal, string> = {
  lighter: "eating lighter",
  training: "training",
  family: "feeding the family",
  everyday: "eating better",
};

export function StartFlow({
  candidates,
  zones,
  initialZone,
  initialGoal,
  initialRecipe,
  freeDeliveryThreshold,
  next,
}: {
  candidates: StarterCandidate[];
  zones: Zone[];
  initialZone: string | null;
  initialGoal: MenuGoal | null;
  /** A recipe the visitor chose on the homepage, kept in their first week. */
  initialRecipe: string | null;
  freeDeliveryThreshold: number;
  next: string | null;
}) {
  const [[index, direction], setIndex] = useState<[number, 1 | -1]>([0, 1]);
  const step: Step = STEPS[index];
  const go = (to: number) => {
    setIndex(([from]) => {
      const dir = to >= from ? 1 : -1;
      // No day to pick outside our areas: step over it either way.
      const target = STEPS[to] === "day" && notListed ? to + dir : to;
      return [target, dir];
    });
    window.scrollTo({ top: 0 });
  };

  const [goal, setGoal] = useState<MenuGoal | null>(initialGoal);
  // Arriving from "Feed the family" on the homepage starts the table at four, like picking it here.
  const [adults, setAdults] = useState(initialGoal === "family" ? 2 : 1);
  const [kids, setKids] = useState(initialGoal === "family" ? 2 : 0);
  const tableTouched = useRef(false);
  const [dietary, setDietary] = useState<Dietary>("none");
  const [dietaryDetail, setDietaryDetail] = useState("");
  // null: the goal's own three recipes, until the customer changes the set.
  const [picked, setPicked] = useState<string[] | null>(() =>
    initialRecipe ? [...new Set([initialRecipe, ...MENU.filter((r) => r.goal === initialGoal).map((r) => r.slug)])] : null,
  );
  // Quantity overrides by product id; 0 means taken out.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const served = zones.filter((z) => z.isServed);
  const soon = zones.filter((z) => !z.isServed);
  const [zone, setZone] = useState<string | null>(served.some((z) => z.slug === initialZone) ? initialZone : null);
  const [notListed, setNotListed] = useState(false);
  const [locating, setLocating] = useState<"idle" | "finding" | "denied" | "outside">("idle");
  const [day, setDay] = useState<DeliveryDay | null>(served.find((z) => z.slug === initialZone)?.deliveryDays[0] ?? null);

  const recipeSlugs = picked ?? MENU.filter((r) => r.goal === goal).map((r) => r.slug);
  const recipes = MENU.filter((r) => recipeSlugs.includes(r.slug));
  const built = buildRecipeBasket(recipes, adults, kids, candidates);
  const lines = built.lines.map((l) => ({ ...l, quantity: overrides[l.productId] ?? l.quantity }));
  const kept = lines.filter((l) => l.quantity > 0);
  const produce = kept.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const delivery = quoteDelivery(produce, false);
  const people = adults + kids;
  const chosenZone = served.find((z) => z.slug === zone) ?? null;

  // Remember the area for the rest of the site too (the header's "Delivering
  // to…"), the same cookie the area picker elsewhere sets. Best effort.
  const pickZone = (z: Zone) => {
    setNotListed(false);
    setLocating("idle");
    setZone(z.slug);
    if (!day || !z.deliveryDays.includes(day)) setDay(z.deliveryDays[0] ?? null);
    fetch("/api/zone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: z.slug }) }).catch(() => {});
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocating("denied");
      return;
    }
    setLocating("finding");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch("/api/zone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
          });
          const data: { zone?: { slug: string } } = await res.json();
          const found = served.find((z) => z.slug === data.zone?.slug);
          if (found) pickZone(found);
          else {
            setZone(null);
            setNotListed(true);
            setLocating("outside");
          }
        } catch {
          setLocating("denied");
        }
      },
      () => setLocating("denied"),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const pickGoal = (g: MenuGoal) => {
    if (g !== goal) {
      setPicked(null);
      setOverrides({});
      // A family usually means more than one at the table; a starting guess they can change.
      if (g === "family" && !tableTouched.current) {
        setAdults(2);
        setKids(2);
      }
    }
    setGoal(g);
  };
  const toggleRecipe = (slug: string) => {
    setPicked(recipeSlugs.includes(slug) ? recipeSlugs.filter((s) => s !== slug) : [...recipeSlugs, slug]);
  };
  const setLine = (productId: string, quantity: number) => setOverrides((o) => ({ ...o, [productId]: quantity }));

  const ready: Record<Step, boolean> = {
    area: notListed || Boolean(chosenZone),
    goal: Boolean(goal),
    table: dietary !== "allergies" || dietaryDetail.trim().length > 0,
    recipes: recipes.length > 0,
    basket: kept.length > 0,
    day: Boolean(chosenZone && day),
    account: true,
  };

  const [state, formAction, pending] = useActionState<StartState, FormData>(createAccountFromOnboarding, { error: null });
  // Held here because React resets a form's fields after its action runs,
  // and a bounced sign-up shouldn't make anyone retype their name.
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const cta: Record<Step, ReactNode> = {
    area: notListed ? "Continue anyway" : chosenZone ? `Continue in ${chosenZone.name}` : "Pick your area",
    goal: "Continue",
    table: `Continue for ${people} ${people === 1 ? "person" : "people"}`,
    recipes: recipes.length ? `Continue with ${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}` : "Pick a recipe",
    basket: (
      <>
        Looks good, <RollingNumber value={produce + delivery.fee} format={formatNaira} />
      </>
    ),
    day: day ? `${DELIVERY_DAY_LABEL[day] ?? day}s it is` : "Pick a day",
    account: pending ? "Saving your week…" : "Create my account",
  };

  return (
    <div className="hm min-h-svh bg-paper-white text-carbon">
      {/* Top bar: a way back, and how far along you are. */}
      <header className="sticky top-0 z-30 bg-paper-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center gap-4">
          {index === 0 ? (
            <Link href="/" className="logo-wordmark text-[22px] leading-none" aria-label="Basket, home">
              Basket
            </Link>
          ) : (
            <motion.button
              type="button"
              onClick={() => go(index - 1)}
              whileTap={{ scale: press.scale }}
              aria-label="Back"
              className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-(--hm-tint)"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12.5 4.5 7 10l5.5 5.5" />
              </svg>
            </motion.button>
          )}
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Sign-up progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
            {STEPS.map((s, i) => (
              <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--hm-tint-2)">
                <motion.span
                  className="block h-full origin-left rounded-full bg-carbon"
                  initial={false}
                  animate={{ scaleX: i <= index ? 1 : 0 }}
                  transition={spring.smooth}
                />
              </span>
            ))}
          </div>
          <span className="w-9 shrink-0 text-right text-[13px] font-medium text-(--hm-ink-3) tabular-nums">
            {index + 1}/{STEPS.length}
          </span>
        </div>
      </header>

      <main className="mx-auto w-[min(560px,calc(100%-32px))] pt-4 pb-36">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: 32 * d, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: -32 * d, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.smooth}
          >
            {step === "goal" && (
              <>
                <Kachi>
                  {notListed
                    ? "Let's plan your week anyway. Tell me what you're working toward."
                    : `${chosenZone ? `${chosenZone.name}, perfect. ` : ""}Now tell me what you're working toward and I'll plan your first week around it.`}
                </Kachi>
                <Title>What are you working toward?</Title>
                <LayoutGroup id="start-goal">
                  <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Your goal">
                    {MENU_GOALS.map((g) => {
                      const cover = MENU.find((r) => r.goal === g.id);
                      const on = goal === g.id;
                      return (
                        <motion.button
                          key={g.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => pickGoal(g.id)}
                          whileTap={{ scale: press.scaleLarge }}
                          transition={spring.snappy}
                          className={`relative flex items-center gap-4 rounded-[24px] p-3 pr-4 text-left transition-colors ${on ? "bg-paper-white" : "bg-(--hm-tint) hover:bg-(--hm-tint-2)"}`}
                        >
                          {on && (
                            <motion.span layoutId="goal-ring" transition={spring.indicator} className="pointer-events-none absolute inset-0 rounded-[24px] ring-2 ring-carbon" aria-hidden />
                          )}
                          {cover && (
                            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px]">
                              <Image src={cover.image} alt="" fill sizes="64px" className="object-cover" />
                            </span>
                          )}
                          <span className="relative min-w-0 flex-1">
                            <b className="block text-[17px] font-semibold tracking-[-0.02em]">{g.label}</b>
                            <span className="mt-0.5 block text-[14px] leading-snug text-(--hm-ink-2)">&ldquo;{g.prompt}&rdquo;</span>
                          </span>
                          <Tick on={on} />
                        </motion.button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </>
            )}

            {step === "table" && (
              <>
                <Kachi>I&apos;ll size every recipe for your table, and keep out anything you avoid.</Kachi>
                <Title>Who are you cooking for?</Title>
                <div className="mt-6 grid gap-2.5">
                  <Stepper
                    label="Adults"
                    value={adults}
                    min={1}
                    max={12}
                    onChange={(v) => {
                      tableTouched.current = true;
                      setAdults(v);
                    }}
                  />
                  <Stepper
                    label="Children"
                    value={kids}
                    min={0}
                    max={12}
                    onChange={(v) => {
                      tableTouched.current = true;
                      setKids(v);
                    }}
                  />
                </div>

                <h2 className="mt-9 text-[17px] font-semibold tracking-[-0.02em]">Anything you avoid?</h2>
                <LayoutGroup id="start-diet">
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Dietary needs">
                    {DIETARY.map(([value, label]) => (
                      <Chip key={value} on={dietary === value} onClick={() => setDietary(value)} layoutId="diet-pill">
                        {label}
                      </Chip>
                    ))}
                  </div>
                </LayoutGroup>
                <AnimatePresence initial={false}>
                  {dietary === "allergies" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.smooth} className="overflow-hidden">
                      <textarea
                        rows={2}
                        autoFocus
                        value={dietaryDetail}
                        onChange={(e) => setDietaryDetail(e.target.value)}
                        placeholder="Peanuts, okra, anything spicy…"
                        aria-label="What should we keep out of your basket?"
                        className="mt-3 w-full resize-none rounded-[18px] bg-(--hm-tint) px-4 py-3.5 text-[16px] outline-none placeholder:text-(--hm-ink-3) focus:ring-2 focus:ring-carbon"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {step === "recipes" && (
              <>
                <Kachi>
                  {initialRecipe
                    ? `I've kept the recipe you picked and added a few for ${goal ? GOAL_PHRASE[goal] : "your goal"}. Add or swap any of them.`
                    : `I've started you with three for ${goal ? GOAL_PHRASE[goal] : "your goal"}. Add or swap any of them.`}
                </Kachi>
                <Title>Pick your first week</Title>
                <RecipeGrid label={`For ${goal ? GOAL_PHRASE[goal] : "your goal"}`} recipes={MENU.filter((r) => r.goal === goal)} picked={recipeSlugs} onToggle={toggleRecipe} candidates={candidates} />
                <RecipeGrid label="More from this week's menu" recipes={MENU.filter((r) => r.goal !== goal)} picked={recipeSlugs} onToggle={toggleRecipe} candidates={candidates} />
              </>
            )}

            {step === "basket" && (
              <>
                <Kachi>
                  Everything Basket sends for {recipes.length === 1 ? "your recipe" : `your ${recipes.length} recipes`}, sized for {people}. Change anything you like.
                </Kachi>
                <Title>Your first basket</Title>

                <div className="hm-panel mt-6 p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <RollingNumber value={produce + delivery.fee} format={formatNaira} className="text-[34px] leading-none font-semibold tracking-[-0.045em]" />
                    <span className="text-[14px] text-(--hm-ink-2)">for the week</span>
                  </div>
                  <div className="mt-4 space-y-2 text-[14px]">
                    <div className="flex justify-between">
                      <span className="text-(--hm-ink-2)">Produce, {kept.length} items</span>
                      <RollingNumber value={produce} format={formatNaira} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-(--hm-ink-2)">Delivery</span>
                      {delivery.isFree ? (
                        <span className="rounded-full bg-mint-pop px-2.5 py-0.5 text-[13px] font-semibold">Free</span>
                      ) : (
                        <span>{formatNaira(delivery.fee)}</span>
                      )}
                    </div>
                  </div>
                  {!delivery.isFree && (
                    <p className="mt-3 text-[13px] text-(--hm-ink-2)">
                      Free delivery from {formatNaira(freeDeliveryThreshold)}, {formatNaira(delivery.toFreeDelivery)} away.
                    </p>
                  )}
                </div>

                <ul className="mt-5">
                  {lines.map((l) => {
                    const out = l.quantity === 0;
                    return (
                      <motion.li key={l.productId} layout="position" transition={spring.smooth} className="flex items-center gap-3 border-b border-(--hm-line) py-3 last:border-0">
                        <ProductImage
                          publicId={l.cloudinaryPublicId}
                          alt=""
                          emoji={l.imageEmoji}
                          sizes="48px"
                          rounded="rounded-[14px]"
                          flavour="bg-(--hm-tint)"
                          emojiClassName="text-2xl"
                          className={`h-12 w-12 shrink-0 transition-opacity ${out ? "opacity-35" : ""}`}
                        />
                        <span className={`min-w-0 flex-1 transition-opacity ${out ? "opacity-45" : ""}`}>
                          <b className="block truncate text-[15px] font-semibold">{shortName(l.name)}</b>
                          <small className="block truncate text-[13px] text-(--hm-ink-3)">
                            {l.usedBy.length > 1 ? `In ${l.usedBy.length} recipes` : l.usedBy[0]}
                          </small>
                        </span>
                        {out ? (
                          <button type="button" onClick={() => setLine(l.productId, l.minOrderQty)} className="h-9 rounded-full bg-(--hm-tint) px-3.5 text-[13px] font-semibold">
                            Add back
                          </button>
                        ) : (
                          <QtyStepper
                            label={shortName(l.name)}
                            value={l.quantity}
                            onLess={() => setLine(l.productId, l.quantity <= l.minOrderQty ? 0 : l.quantity - l.stepQty)}
                            onMore={() => setLine(l.productId, snapQuantity(l.quantity + l.stepQty, l.minOrderQty, l.stepQty))}
                          />
                        )}
                      </motion.li>
                    );
                  })}
                </ul>

                {built.elsewhere.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-[15px] font-semibold">Grab these elsewhere</h2>
                    <p className="mt-1 text-[13px] text-(--hm-ink-2)">Proteins, grains and dairy we don&apos;t sell, so your list is short.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {built.elsewhere.map((e) => (
                        <span key={e} className="inline-flex h-8 items-center rounded-full border border-dashed border-ember px-3 text-[13px] font-medium">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === "area" && (
              <>
                <Kachi>Hi, I&apos;m Kachi. First, where are you? I&apos;ll check we deliver there before we plan anything.</Kachi>
                <Title>Where should we deliver?</Title>

                <motion.button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating === "finding"}
                  whileTap={{ scale: press.scale }}
                  transition={spring.snappy}
                  className="mt-6 flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-(--hm-tint) text-[15px] font-semibold transition-colors hover:bg-(--hm-tint-2) disabled:opacity-60"
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10 18s5.5-5.2 5.5-9.5a5.5 5.5 0 1 0-11 0C4.5 12.8 10 18 10 18Z" />
                    <circle cx="10" cy="8.5" r="2" />
                  </svg>
                  {locating === "finding" ? "Finding you…" : "Use my location"}
                </motion.button>
                {locating === "denied" && (
                  <p className="mt-2.5 text-center text-[13px] text-(--hm-ink-2)">Couldn&apos;t get your location. Pick your area below instead.</p>
                )}

                <p className="mt-6 mb-2.5 text-[13px] font-semibold text-(--hm-ink-2)">Or pick your area</p>
                <LayoutGroup id="start-zone">
                  <div className="grid gap-2.5" role="radiogroup" aria-label="Delivery area">
                    {served.map((z) => {
                      const on = zone === z.slug && !notListed;
                      return (
                        <motion.button
                          key={z.slug}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => pickZone(z)}
                          whileTap={{ scale: press.scaleLarge }}
                          transition={spring.snappy}
                          className={`relative flex w-full items-center gap-3 rounded-[20px] px-4 py-3.5 text-left transition-colors ${on ? "bg-paper-white" : "bg-(--hm-tint) hover:bg-(--hm-tint-2)"}`}
                        >
                          {on && <motion.span layoutId="zone-ring" transition={spring.indicator} className="pointer-events-none absolute inset-0 rounded-[20px] ring-2 ring-carbon" aria-hidden />}
                          <span className="relative min-w-0 flex-1">
                            <b className="block text-[16px] font-semibold">{z.name}</b>
                            <span className="block truncate text-[13px] text-(--hm-ink-2)">{z.area}</span>
                          </span>
                          <span className="relative shrink-0 text-[13px] text-(--hm-ink-3)">
                            {z.deliveryDays.map((d) => (DELIVERY_DAY_LABEL[d] ?? d).slice(0, 3)).join(", ")}
                          </span>
                          <Tick on={on} />
                        </motion.button>
                      );
                    })}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={notListed}
                      onClick={() => {
                        setZone(null);
                        setNotListed(true);
                        setLocating("idle");
                      }}
                      className={`rounded-[20px] px-4 py-3.5 text-left text-[15px] font-medium transition-colors ${notListed ? "bg-paper-white ring-2 ring-carbon" : "text-(--hm-ink-2) hover:bg-(--hm-tint)"}`}
                    >
                      My area isn&apos;t listed
                    </button>
                  </div>
                </LayoutGroup>

                <AnimatePresence initial={false}>
                  {notListed && (
                    <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.smooth} className="hm-panel mt-5 p-4 text-[14px] leading-relaxed">
                      {locating === "outside" ? "You're outside the areas we reach right now. " : ""}
                      We don&apos;t deliver there yet{soon.length ? ` (next up: ${soon.map((z) => z.name).join(", ")})` : ""}. You can still plan your week: your recipes and basket stay saved, and you can set your area the day we arrive.
                    </motion.p>
                  )}
                </AnimatePresence>

                <p className="mt-6 text-center text-[14px] text-(--hm-ink-2)">
                  Already have an account?{" "}
                  <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-carbon underline underline-offset-2">
                    Sign in
                  </Link>
                </p>
              </>
            )}

            {step === "day" && chosenZone && (
              <>
                <Kachi>Last thing before your account: which day should it arrive?</Kachi>
                <Title>Which day suits you?</Title>
                <p className="mt-2 text-[15px] text-(--hm-ink-2)">
                  {chosenZone.name} gets deliveries on {listDays(chosenZone.deliveryDays)}.{" "}
                  <button type="button" onClick={() => go(0)} className="font-semibold text-carbon underline underline-offset-2">
                    Change area
                  </button>
                </p>
                <LayoutGroup id="start-day">
                  <div className="mt-6 grid gap-2.5" role="radiogroup" aria-label="Delivery day">
                    {chosenZone.deliveryDays.map((d) => {
                      const on = day === d;
                      return (
                        <motion.button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setDay(d)}
                          whileTap={{ scale: press.scaleLarge }}
                          transition={spring.snappy}
                          className={`relative flex w-full items-center gap-3 rounded-[20px] px-4 py-4 text-left transition-colors ${on ? "bg-paper-white" : "bg-(--hm-tint) hover:bg-(--hm-tint-2)"}`}
                        >
                          {on && <motion.span layoutId="day-ring" transition={spring.indicator} className="pointer-events-none absolute inset-0 rounded-[20px] ring-2 ring-carbon" aria-hidden />}
                          <span className="relative min-w-0 flex-1">
                            <b className="block text-[16px] font-semibold">{DELIVERY_DAY_LABEL[d] ?? d}s</b>
                            <span className="block text-[13px] text-(--hm-ink-2)">First one {firstDelivery(d)}, 9am to 5pm</span>
                          </span>
                          <Tick on={on} />
                        </motion.button>
                      );
                    })}
                  </div>
                </LayoutGroup>
                <p className="mt-4 text-[13px] leading-relaxed text-(--hm-ink-2)">Change it until the night before, or skip a week.</p>
              </>
            )}

            {step === "account" && (
              <>
                <Kachi>Your week is ready. Make a free account to keep it.</Kachi>
                <Title>Save your week</Title>

                <dl className="hm-panel mt-6 divide-y divide-(--hm-line) px-5 text-[14px]">
                  <Row term="Goal">{goalLabel(goal)}</Row>
                  <Row term="Recipes">
                    {recipes.length} for {people} {people === 1 ? "person" : "people"}
                  </Row>
                  <Row term="Basket">
                    {kept.length} items, {formatNaira(produce + delivery.fee)}
                  </Row>
                  <Row term="Delivery">{chosenZone && day && !notListed ? `${chosenZone.name}, ${DELIVERY_DAY_LABEL[day]}s` : "Not in your area yet"}</Row>
                </dl>

                {state.error && (
                  <p role="alert" className="mt-5 rounded-[18px] bg-ember/12 p-4 text-[14px] leading-relaxed">
                    {state.error === "failed" ? (
                      <>
                        We couldn&apos;t create an account with those details. If you already have one,{" "}
                        <Link href="/login" className="font-semibold underline underline-offset-2">
                          sign in
                        </Link>{" "}
                        or{" "}
                        <Link href="/forgot-password" className="font-semibold underline underline-offset-2">
                          reset your password
                        </Link>
                        .
                      </>
                    ) : state.error === "missing"
                      ? "Add your name, an email or phone number, and a password of at least 8 characters."
                      : "Too many sign-ups from this network. Wait a little and try again."}
                  </p>
                )}

                <form id="start-account" action={formAction} className="mt-6 space-y-3">
                  <input type="hidden" name="goal" value={goal ?? ""} />
                  <input type="hidden" name="adults" value={adults} />
                  <input type="hidden" name="kids" value={kids} />
                  <input type="hidden" name="dietary" value={dietary} />
                  <input type="hidden" name="dietaryDetail" value={dietaryDetail} />
                  <input type="hidden" name="zone" value={notListed ? "" : (zone ?? "")} />
                  <input type="hidden" name="deliveryDay" value={day ?? ""} />
                  <input type="hidden" name="recipes" value={JSON.stringify(recipeSlugs)} />
                  <input type="hidden" name="items" value={JSON.stringify(kept.map((l) => ({ productId: l.productId, quantity: l.quantity })))} />
                  {next && <input type="hidden" name="next" value={next} />}

                  <Field label="Your name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Field
                    label="Email or phone"
                    name="contact"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com or 080…"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                  <PasswordInput />
                </form>
                <p className="mt-4 text-[13px] leading-relaxed text-(--hm-ink-3)">
                  Free to join. Nothing is charged until you check out a basket. By creating an account you agree to our{" "}
                  <Link href="/terms" className="underline underline-offset-2">
                    terms
                  </Link>
                  .
                </p>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* The next move, always under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-paper-white from-70% to-paper-white/0 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-[min(560px,calc(100%-32px))]">
          <motion.button
            type={step === "account" ? "submit" : "button"}
            form={step === "account" ? "start-account" : undefined}
            disabled={!ready[step] || pending}
            onClick={step === "account" ? undefined : () => go(index + 1)}
            whileTap={{ scale: press.scale }}
            transition={spring.snappy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-carbon text-[16px] font-semibold text-paper-white transition-opacity disabled:opacity-30"
          >
            {cta[step]}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Kachi({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <KachiMark className="mt-0.5 h-8 w-8" />
      <p className="rounded-[18px] rounded-tl-md bg-(--hm-tint) px-4 py-2.5 text-[15px] leading-snug">{children}</p>
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="mt-6 text-[clamp(1.75rem,6vw,2.25rem)] leading-[1.06] font-semibold tracking-[-0.04em] text-balance">{children}</h1>;
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors ${on ? "bg-carbon text-paper-white" : "bg-paper-white shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.18)]"}`} aria-hidden>
      <AnimatePresence initial={false}>
        {on && (
          <motion.span key="t" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.juicy}>
            <Icon name="checkPlain" size={14} weight="bold" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Chip({ on, onClick, layoutId, children }: { on: boolean; onClick: () => void; layoutId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-11 rounded-full px-4.5 text-[15px] font-semibold transition-colors ${on ? "text-paper-white" : "bg-(--hm-tint) text-carbon/75 hover:text-carbon"}`}
    >
      {on && <motion.span layoutId={layoutId} transition={spring.indicator} className="absolute inset-0 rounded-full bg-carbon" />}
      <span className="relative">{children}</span>
    </button>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const btn = "grid h-10 w-10 place-items-center rounded-full bg-paper-white text-lg leading-none font-semibold disabled:opacity-35";
  return (
    <div className="flex h-16 items-center justify-between rounded-[20px] bg-(--hm-tint) pr-3 pl-5">
      <span className="text-[16px] font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <motion.button whileTap={{ scale: press.scale }} type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
          −
        </motion.button>
        <RollingNumber value={value} className="min-w-6 justify-center text-center text-[17px] font-semibold" />
        <motion.button whileTap={{ scale: press.scale }} type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
          +
        </motion.button>
      </div>
    </div>
  );
}

function QtyStepper({ label, value, onLess, onMore }: { label: string; value: number; onLess: () => void; onMore: () => void }) {
  const btn = "grid h-8 w-8 place-items-center rounded-full text-base leading-none font-semibold";
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-(--hm-tint) p-0.5">
      <motion.button whileTap={{ scale: press.scale }} type="button" aria-label={`Less ${label}`} onClick={onLess} className={btn}>
        −
      </motion.button>
      <RollingNumber value={value} className="min-w-5 justify-center text-center text-[14px] font-semibold" />
      <motion.button whileTap={{ scale: press.scale }} type="button" aria-label={`More ${label}`} onClick={onMore} className={`${btn} bg-paper-white`}>
        +
      </motion.button>
    </div>
  );
}

function RecipeGrid({
  label,
  recipes,
  picked,
  onToggle,
  candidates,
}: {
  label: string;
  recipes: MenuRecipe[];
  picked: string[];
  onToggle: (slug: string) => void;
  candidates: StarterCandidate[];
}) {
  const stocked = new Set(candidates.map((c) => c.slug));
  if (recipes.length === 0) return null;
  return (
    <div className="mt-7">
      <h2 className="text-[15px] font-semibold text-(--hm-ink-2)">{label}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {recipes.map((r) => {
          const on = picked.includes(r.slug);
          const fromBasket = r.basket.filter((s) => stocked.has(s)).length;
          const total = r.basket.length + r.elsewhere.length;
          return (
            <motion.button
              key={r.slug}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(r.slug)}
              whileTap={{ scale: press.scaleLarge }}
              transition={spring.snappy}
              className="group text-left"
            >
              <span className={`relative block aspect-4/3 overflow-hidden rounded-[20px] ring-offset-2 transition-shadow ${on ? "ring-2 ring-carbon" : ""}`}>
                <Image src={r.image} alt={r.alt} fill sizes="(min-width: 600px) 270px, 45vw" className={`object-cover transition-[filter] ${on ? "" : "saturate-[0.85]"}`} />
                <span className="absolute top-2 left-2 rounded-full bg-paper-white/92 px-2 py-0.5 text-[12px] font-semibold">{r.minutes} min</span>
                <span className="absolute top-2 right-2">
                  <Tick on={on} />
                </span>
              </span>
              <b className="mt-2 block text-[14px] leading-snug font-semibold">{r.title}</b>
              <span className="mt-0.5 block text-[12px] text-(--hm-ink-3)">
                {fromBasket} of {total} from Basket
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-(--hm-ink-2)">{term}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

const INPUT =
  "h-14 w-full rounded-[18px] bg-(--hm-tint) px-4 text-[16px] outline-none transition-shadow placeholder:text-(--hm-ink-3) focus:bg-paper-white focus:ring-2 focus:ring-carbon";

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <input name={name} required className={INPUT} {...rest} />
    </label>
  );
}

function PasswordInput() {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium">Password</span>
      <span className="relative block">
        <input name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" className={`${INPUT} pr-20`} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-full px-3 text-[13px] font-semibold text-(--hm-ink-2) hover:text-carbon"
        >
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
