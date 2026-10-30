"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { DELIVERY_DAY_LABEL, formatNaira } from "@/lib/format";
import { nextDeliveryDate } from "@/lib/delivery-dates";
import { inWeekOrder, shortDate } from "@/lib/delivery-labels";
import { quoteDelivery } from "@/lib/pricing";
import type { StarterCandidate } from "@/lib/starter-basket-core";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { KachiMark } from "@/components/kachi-mark";
import { ProductImage } from "@/components/product-image";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Icon } from "@/components/ui/icon";
import { MENU_GOALS, type MenuGoal, type MenuRecipe } from "../home-menu/recipes";
import { useMenu } from "@/components/menu-provider";
import { shortName } from "../home-menu/parts/shared";
import { haptic } from "@/lib/haptics";
import { buildRecipeBasket, snapQuantity, type BasketLine } from "./recipe-basket";
import { OwnBasketSheet } from "./own-basket-sheet";
import { createAccountFromOnboarding, type StartState } from "./actions";
import { findMyArea, locateHelp } from "@/lib/locate";

type Zone = { slug: string; name: string; area: string; isServed: boolean; deliveryDays: DeliveryDay[]; cutoffHour: number };
type Dietary = "none" | "vegetarian" | "vegan" | "allergies";

/**
 * Sign-up, as the homepage promises it: say where you are, tell Kachi your
 * goal, get a week of recipes and the basket to cook them, pick your day.
 * Short screens, one question each, with the answer that unlocks the next one
 * always in reach of a thumb at the bottom. The account comes last, after the
 * customer has seen what they are getting.
 *
 * The plan comes first: goal, table, recipes, basket. Then where it goes and
 * which of that area's days it arrives on, just before the account. Outside
 * our areas the day is skipped, and the week is still saved.
 */
const STEPS = ["goal", "table", "recipes", "basket", "area", "day", "account"] as const;
/**
 * Arriving from the shop with a cart, the plan is already made: their cart.
 * So it's the cart, what they're after (it shapes their Home), where, which
 * day, and the account. Paying comes straight after, in the same style.
 */
const CART_STEPS = ["cart", "goal", "area", "day", "account"] as const;
type Step = (typeof STEPS)[number] | (typeof CART_STEPS)[number];

/** A visitor's cart, as sign-up shows it. */
export type StartCart = { items: { productId: string; name: string; amount: string; lineTotal: number; publicId: string | null; emoji: string }[]; subtotal: number };

const DIETARY: [Dietary, string][] = [
  ["none", "No restrictions"],
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["allergies", "Allergies or dislikes"],
];

/** The first delivery on that day the area can still take, by its real cutoff: the same date Home will show. */
function firstDelivery(day: DeliveryDay, cutoffHour: number) {
  return shortDate(nextDeliveryDate(day, cutoffHour));
}

/** The area's day that comes soonest, which is the one to suggest. */
function soonestDay(z: Zone): DeliveryDay | null {
  const days = inWeekOrder(z.deliveryDays);
  if (!days.length) return null;
  return days.reduce((best, d) => (nextDeliveryDate(d, z.cutoffHour) < nextDeliveryDate(best, z.cutoffHour) ? d : best));
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
  busy: "busy weeks",
  plants: "eating more plants",
  fruit: "fresh fruit every week",
};

export function StartFlow({
  candidates,
  zones,
  initialZone,
  initialGoal,
  initialRecipe,
  freeDeliveryThreshold,
  next,
  referralCode,
  cart,
}: {
  candidates: StarterCandidate[];
  zones: Zone[];
  initialZone: string | null;
  initialGoal: MenuGoal | null;
  /** A recipe the visitor chose on the homepage, kept in their first week. */
  initialRecipe: string | null;
  freeDeliveryThreshold: number;
  next: string | null;
  /** From an invite link (/start?ref=CODE): both get credit after the first delivery. */
  referralCode: string | null;
  /** What they put in a cart before signing up, if anything. */
  cart: StartCart | null;
}) {
  const MENU = useMenu();
  const [[index, direction], setIndex] = useState<[number, 1 | -1]>([0, 1]);
  const steps: readonly Step[] = cart ? CART_STEPS : STEPS;
  const step: Step = steps[index];
  const go = (to: number) => {
    setIndex(([from]) => {
      const dir = to >= from ? 1 : -1;
      // No day to pick outside our areas: step over it either way.
      const target = steps[to] === "day" && notListed ? to + dir : to;
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
  const [locateNote, setLocateNote] = useState("");
  const [day, setDay] = useState<DeliveryDay | null>(() => {
    const z = served.find((x) => x.slug === initialZone);
    return z ? soonestDay(z) : null;
  });

  const recipeSlugs = picked ?? MENU.filter((r) => r.goal === goal).map((r) => r.slug);
  const recipes = MENU.filter((r) => recipeSlugs.includes(r.slug));
  const built = buildRecipeBasket(recipes, adults, kids, candidates);
  const fromRecipes = built.lines.map((l) => ({ ...l, quantity: overrides[l.productId] ?? l.quantity }));
  // Anything they added themselves ("Create your own basket"), shown first.
  const inRecipes = new Set(built.lines.map((l) => l.productId));
  const own: BasketLine[] = candidates
    .filter((c) => !inRecipes.has(c.id) && (overrides[c.id] ?? 0) > 0)
    .map((c) => ({ productId: c.id, slug: c.slug, name: c.name, imageEmoji: c.imageEmoji, cloudinaryPublicId: c.cloudinaryPublicId, standardPrice: c.standardPrice, minOrderQty: c.minOrderQty, stepQty: c.stepQty, quantity: overrides[c.id], usedBy: [] }));
  const lines = [...own, ...fromRecipes];
  const kept = lines.filter((l) => l.quantity > 0);
  // Once they've made it their own, recipe items they took out tuck away instead of crowding the list.
  const tucked = own.length > 0 ? fromRecipes.filter((l) => l.quantity === 0) : [];
  const [creating, setCreating] = useState(false);
  const [savedOwn, setSavedOwn] = useState(0);
  const saveOwn = (next: Record<string, number>) => {
    // Every product either side knows about: what they picked, and what was there before (now 0 if dropped).
    const ids = new Set([...Object.keys(next), ...lines.map((l) => l.productId)]);
    setOverrides((o) => {
      const out = { ...o };
      for (const id of ids) out[id] = next[id] ?? 0;
      return out;
    });
    setCreating(false);
    setSavedOwn((n) => n + 1);
    haptic("success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const produce = kept.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const delivery = quoteDelivery(produce, false, undefined, freeDeliveryThreshold);
  const people = adults + kids;
  const chosenZone = served.find((z) => z.slug === zone) ?? null;

  // Remember the area for the rest of the site too (the header's "Delivering
  // to…"), the same cookie the area picker elsewhere sets. Best effort.
  const pickZone = (z: Zone) => {
    setNotListed(false);
    setLocating("idle");
    setZone(z.slug);
    if (!day || !z.deliveryDays.includes(day)) setDay(soonestDay(z));
    fetch("/api/zone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: z.slug }) }).catch(() => {});
  };
  const useMyLocation = async () => {
    setLocating("finding");
    const found = await findMyArea();
    const match = found.kind === "zone" ? served.find((z) => z.slug === found.zone.slug) : undefined;
    if (match) pickZone(match);
    else if (found.kind === "failed") {
      setLocateNote(locateHelp(found.reason, "Pick your area below."));
      setLocating("denied");
    } else {
      setZone(null);
      setNotListed(true);
      setLocating("outside");
    }
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
    cart: true,
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
    cart: cart ? (
      <>
        Deliver these, <RollingNumber value={cart.subtotal} format={formatNaira} />
      </>
    ) : (
      "Continue"
    ),
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
            <Link href="/" className="logo-wordmark text-[22px] leading-none" aria-label="BasketNG, home">
              BasketNG
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
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Sign-up progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
            {steps.map((s, i) => (
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
            {index + 1}/{steps.length}
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
            {step === "cart" && cart && (
              <>
                <Kachi>Ooh, good picks. You&apos;ve already done the hard part, so this is quick.</Kachi>
                <Title>Your cart</Title>
                <ul className="hm-panel mt-6 divide-y divide-(--hm-line)">
                  {cart.items.map((l, i) => (
                    <motion.li
                      key={l.productId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring.smooth, delay: 0.05 + i * 0.04 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <ProductImage publicId={l.publicId} alt="" emoji={l.emoji} sizes="44px" className="size-11 shrink-0" rounded="rounded-xl" emojiClassName="text-xl" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px] font-semibold">{shortName(l.name)}</b>
                        <span className="text-[13px] text-(--hm-ink-3)">{l.amount}</span>
                      </span>
                      <span className="shrink-0 text-[15px] font-medium tabular-nums">{formatNaira(l.lineTotal)}</span>
                    </motion.li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center justify-between px-1 text-[14px] text-(--hm-ink-2)">
                  <span>Delivery is worked out for your area next.</span>
                  <Link href="/shop" className="font-semibold text-carbon underline underline-offset-2">
                    Add more
                  </Link>
                </p>
              </>
            )}

            {step === "goal" && (
              <>
                <Kachi>
                  {cart
                    ? "One quick one: what are you after? I'll set up your Home around it."
                    : "Hey, I'm Kachi. Tell me what you're after and I'll build your first basket around it. No wrong answers, promise."}
                </Kachi>
                <Title>What are you working toward?</Title>
                <LayoutGroup id="start-goal">
                  <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Your goal">
                    {MENU_GOALS.map((g) => {
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
                          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-(--hm-tint-2)">
                            <Image src={`/images/goals/${g.id}.jpg`} alt="" fill sizes="64px" className="object-cover" />
                          </span>
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

                <SignInLink next={next} />
              </>
            )}

            {step === "table" && (
              <>
                <Kachi>Who&apos;s eating? I&apos;ll size everything for your table, and keep out anything you&apos;d rather not.</Kachi>
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
                    : `I've started you with ${recipes.length === 1 ? "one" : recipes.length === 2 ? "two" : recipes.length === 3 ? "three" : recipes.length} for ${goal ? GOAL_PHRASE[goal] : "your goal"}. Add or swap any of them.`}
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

                <AnimatePresence>
                  {savedOwn > 0 && (
                    <motion.p
                      key={savedOwn}
                      role="status"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring.smooth}
                      onAnimationComplete={() => window.setTimeout(() => setSavedOwn((n) => (n === savedOwn ? 0 : n)), 3200)}
                      className="mt-4 flex items-center gap-2 rounded-[16px] bg-mint-pop/35 px-4 py-3 text-[14px] font-semibold"
                    >
                      <Icon name="checkPlain" size={16} weight="bold" />
                      Saved. This is your basket now.
                    </motion.p>
                  )}
                </AnimatePresence>

                <ul className="mt-5">
                  {lines.filter((l) => !tucked.includes(l)).map((l) => {
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
                            {l.usedBy.length === 0 ? "Your pick" : l.usedBy.length > 1 ? `In ${l.usedBy.length} recipes` : l.usedBy[0]}
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

                {tucked.length > 0 && (
                  <details className="mt-3 text-[14px]">
                    <summary className="cursor-pointer py-2 text-(--hm-ink-3)">
                      Taken out from your recipes ({tucked.length})
                    </summary>
                    <ul>
                      {tucked.map((l) => (
                        <li key={l.productId} className="flex items-center justify-between gap-3 py-2">
                          <span className="truncate text-(--hm-ink-2)">{shortName(l.name)}</span>
                          <button type="button" onClick={() => setLine(l.productId, l.minOrderQty)} className="h-8 shrink-0 rounded-full bg-(--hm-tint) px-3 text-[13px] font-semibold">
                            Add back
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* The quiet way to start from scratch: the making is the experience. */}
                <motion.button
                  type="button"
                  whileTap={{ scale: press.scale }}
                  transition={spring.snappy}
                  onClick={() => {
                    haptic("light");
                    setCreating(true);
                  }}
                  className="mt-5 flex w-full items-center gap-3 rounded-[18px] border border-dashed border-(--hm-line-2,#d4d4cf) px-4 py-3.5 text-left transition-colors hover:bg-(--hm-tint)"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--hm-tint)">
                    <Icon name="plus" size={16} weight="bold" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-semibold">Create your own basket</b>
                    <small className="block text-[13px] text-(--hm-ink-3)">Pick your own fruit and veg. Your recipes stay saved.</small>
                  </span>
                </motion.button>
                <OwnBasketSheet
                  open={creating}
                  onClose={() => setCreating(false)}
                  candidates={candidates}
                  current={Object.fromEntries(kept.map((l) => [l.productId, l.quantity]))}
                  onSave={saveOwn}
                />

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
                <Kachi>{cart ? "Where are these going? Let me check we come to you." : "Looking good. Where should it go? Let me check we come to you."}</Kachi>
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
                  <p role="status" className="mt-2.5 text-center text-[13px] text-(--hm-ink-2)">
                    {locateNote}
                  </p>
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
                            {inWeekOrder(z.deliveryDays).map((d) => (DELIVERY_DAY_LABEL[d] ?? d).slice(0, 3)).join(", ")}
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
                      We don&apos;t deliver there yet{soon.length ? ` (next up: ${soon.map((z) => z.name).join(", ")})` : ""}. Your week stays saved: make your account and set your area the day we arrive.
                    </motion.p>
                  )}
                </AnimatePresence>
              </>
            )}

            {step === "day" && chosenZone && (
              <>
                <Kachi>Which day suits you? Pick the one when you&apos;re actually home to enjoy it.</Kachi>
                <Title>Which day suits you?</Title>
                <p className="mt-2 text-[15px] text-(--hm-ink-2)">
                  {chosenZone.name} gets deliveries on {listDays(inWeekOrder(chosenZone.deliveryDays))}.{" "}
                  <button type="button" onClick={() => go(steps.indexOf("area"))} className="font-semibold text-carbon underline underline-offset-2">
                    Change area
                  </button>
                </p>
                <LayoutGroup id="start-day">
                  <div className="mt-6 grid gap-2.5" role="radiogroup" aria-label="Delivery day">
                    {inWeekOrder(chosenZone.deliveryDays).map((d) => {
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
                            <span className="block text-[13px] text-(--hm-ink-2)">First one {firstDelivery(d, chosenZone.cutoffHour)}, 9am to 5pm</span>
                          </span>
                          <Tick on={on} />
                        </motion.button>
                      );
                    })}
                  </div>
                </LayoutGroup>
                <p className="mt-4 text-[13px] leading-relaxed text-(--hm-ink-2)">Your first basket comes once, as a trial. Members get theirs every week, with a reminder before each delivery.</p>
              </>
            )}

            {step === "account" && (
              <>
                <Kachi>{cart ? "Last bit. Make your free account and these are yours." : "Your basket's ready. One last thing and it's yours."}</Kachi>
                <Title>{cart ? "Make it yours" : "Save your basket"}</Title>

                <dl className="hm-panel mt-6 divide-y divide-(--hm-line) px-5 text-[14px]">
                  {cart ? (
                    <Row term="Your cart">
                      {cart.items.length} {cart.items.length === 1 ? "item" : "items"}, {formatNaira(cart.subtotal)}
                    </Row>
                  ) : (
                    <>
                      <Row term="Goal">{goalLabel(goal)}</Row>
                      <Row term="Recipes">
                        {recipes.length} for {people} {people === 1 ? "person" : "people"}
                      </Row>
                      <Row term="Basket">
                        {kept.length} items, {formatNaira(produce + delivery.fee)}
                      </Row>
                    </>
                  )}
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
                  <input type="hidden" name="items" value={cart ? "[]" : JSON.stringify(kept.map((l) => ({ productId: l.productId, quantity: l.quantity })))} />
                  {cart && <input type="hidden" name="fromCart" value="1" />}
                  {next && <input type="hidden" name="next" value={next} />}
                  {referralCode && <input type="hidden" name="ref" value={referralCode} />}

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
                  Free to join. Next, you&apos;ll see your basket and can pay for it, or leave it for later. By creating an account you agree to our{" "}
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
            {step === "account" ? (pending ? "Setting you up…" : "Create my account") : cta[step]}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Kachi({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <KachiMark className="mt-0.5 h-8 w-8" />
      <p className="rounded-[18px] rounded-tl-md bg-(--hm-tint) px-4 py-2.5 text-[15px] leading-snug">{children}</p>
    </div>
  );
}

export function Title({ children }: { children: ReactNode }) {
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

export function QtyStepper({ label, value, onLess, onMore }: { label: string; value: number; onLess: () => void; onMore: () => void }) {
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

export function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
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

/** For people who already have an account, on the first screen. */
function SignInLink({ next }: { next: string | null }) {
  return (
    <p className="mt-6 text-center text-[14px] text-(--hm-ink-2)">
      Already have an account?{" "}
      <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-carbon underline underline-offset-2">
        Sign in
      </Link>
    </p>
  );
}
