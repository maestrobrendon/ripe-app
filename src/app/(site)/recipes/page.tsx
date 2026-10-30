import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { GOALS } from "@/lib/assistant";
import { GOAL_LABEL, HOUSEHOLD_TYPE_LABEL } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { matchProductByName } from "@/lib/ingredient-match";
import { RecipeLibrary, type LibraryRecipe } from "./recipe-library";
import { ProduceListTab } from "./produce-list-tab";
import { WeeklyMealPlanBuilder, MealPlanGate, type DayView, type MealOption, type RecipeOption } from "./weekly-meal-plan";
import { readActiveDelivery } from "@/lib/order-container";
import { getDeliveryCycle, zoneForUser } from "@/lib/delivery";
import { longDate } from "@/lib/delivery-labels";
import { getOrCreateWeeklyPlan, weekStartWithOffset, parseDays, MEAL_SLOTS } from "@/lib/weekly-meal-plan";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { MENU_GOALS, type MenuGoal, type MenuRecipe } from "@/lib/menu-types";
import { getMenu } from "@/lib/menu";
import { Eyebrow } from "@/app/(bare)/home-menu/parts/shared";
import { MenuBrowser } from "./menu-browser";
import { KachiMark } from "@/components/kachi-mark";
import { getMenuCards } from "./recipe-data";

// The menu shares the homepage's look: soft tints, photo first.
import "@/app/(bare)/home-menu/home-menu.css";

export const metadata = { title: "Recipes. BasketNG" };

const PLANNER_IMAGE_ID = "basket-recipes-unpacking";
// The guest hero's photo collage: one tall, two stacked.
const HERO_RECIPES = ["nigerian-salad-bowl", "nigerian-fruit-salad-with-condensed-milk", "chunky-vegetable-stew-ata-dindin-style"];
// The signed-in header's little table of dishes.
const HEADER_SLUGS = ["chicken-suya-power-bowl", "nigerian-party-coleslaw-with-sweet-corn", "avocado-toast-with-ata-rodo-salsa"];

/** These dishes if they're still on the menu, topped up from the rest of it if an editor removed one. */
function pickDishes(menu: MenuRecipe[], slugs: string[]): MenuRecipe[] {
  const found = slugs.map((slug) => menu.find((r) => r.slug === slug)).filter((r): r is MenuRecipe => Boolean(r));
  return [...found, ...menu.filter((r) => !found.includes(r))].slice(0, slugs.length);
}

type Tab = "library" | "planner" | "produce";
const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "All recipes" },
  { id: "planner", label: "Meal plan" },
  { id: "produce", label: "Produce list" },
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; goal?: string; ingredient?: string; saved?: string; week?: string; for?: string }>;
}) {
  const { tab: tabParam, goal, ingredient, saved, week: weekParam, for: forParam } = await searchParams;

  const [user, allProducts, menuCards, MENU] = await Promise.all([getCurrentUser(), prisma.product.findMany(), getMenuCards(), getMenu()]);
  // Signed in, "Picked for you" means their goal's recipes come first.
  const userGoal = MENU_GOALS.find((g) => g.starterSlug === (user?.preferences?.primaryGoal ?? ""))?.id ?? null;
  const byGoal = <T extends { goal: string }>(list: T[]) => (userGoal ? [...list.filter((r) => r.goal === userGoal), ...list.filter((r) => r.goal !== userGoal)] : list);
  const HEADER_DISHES = userGoal ? byGoal(MENU.filter((r) => r.image)).slice(0, 3) : pickDishes(MENU, HEADER_SLUGS);
  const bySlug = new Map(allProducts.map((p) => [p.slug, p]));
  const byId = new Map(allProducts.map((p) => [p.id, p]));

  const isSubscriber = Boolean(user?.subscriptionTierId);
  const tier: "guest" | "free" | "subscriber" = !user ? "guest" : isSubscriber ? "subscriber" : "free";
  const tab: Tab = tabParam === "planner" || tabParam === "produce" ? tabParam : "library";
  // Clamped so a stray query param can't generate a WeeklyMealPlan row for
  // some far-off week indefinitely.
  const weekOffset = Math.max(-8, Math.min(8, Number.parseInt(weekParam ?? "0", 10) || 0));
  const weekStartDate = weekStartWithOffset(weekOffset);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekLabel = `${weekStartDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

  const ingredientProduct = ingredient ? bySlug.get(ingredient) : null;

  const savedRecipeIds = user
    ? new Set((await prisma.savedRecipe.findMany({ where: { userId: user.id }, select: { recipeId: true } })).map((s) => s.recipeId))
    : new Set<string>();
  const showSavedFilter = savedRecipeIds.size > 0;
  const isSavedFilter = saved === "1" && showSavedFilter;

  const [recipes, totalRecipes] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        status: "PUBLISHED",
        // The menu above already shows its recipes, and one without a photo isn't ready.
        onMenu: false,
        image: { not: null },
        NOT: { image: "" },
        ...(goal ? { goalTags: { has: goal } } : {}),
        ...(ingredientProduct ? { ingredientProductIds: { has: ingredientProduct.id } } : {}),
        ...(isSavedFilter ? { id: { in: Array.from(savedRecipeIds) } } : {}),
      },
      // The dishes people here already eat first, the less familiar after (sortOrder, set with the menu).
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.recipe.count({ where: { status: "PUBLISHED", onMenu: false, image: { not: null }, NOT: { image: "" } } }),
  ]);

  const prefs = user?.preferences;
  const firstName = user?.name.trim().split(/\s+/)[0] ?? null;
  // The one food-preferences record (Account > Food preferences): household
  // size is adults plus children on the user.
  const defaultServings = user ? user.householdAdults + user.householdKids : 3;

  const isFiltered = Boolean(goal || ingredientProduct || isSavedFilter);

  // What's already in the customer's order (for "you have"), and when it comes.
  let activeBasketProductIds = new Set<string>();
  let deliveryDay: DeliveryDay | null = null;
  let deliveryLine: string | null = null;
  if (user) {
    const activeBasket = await readActiveDelivery(user.id);
    if (activeBasket) {
      activeBasketProductIds = new Set((await prisma.basketItem.findMany({ where: { basketId: activeBasket.id }, select: { productId: true } })).map((i) => i.productId));
      const cycle = await getDeliveryCycle(activeBasket, await zoneForUser(user.id));
      deliveryDay = cycle.day;
      deliveryLine = cycle.date ? `Your order comes ${longDate(cycle.date)}` : null;
    }
  }

  // Weekly meal plan is a subscriber-only feature: a non-subscriber never
  // sees a preview of it, fake or otherwise, just the gate (MealPlanGate).
  // Only fetched when it's actually going to be shown, to keep the other
  // two tabs cheap.
  let mealPlanDayViews: DayView[] = [];
  let ownMealOptions: MealOption[] = [];
  let recipeOptions: RecipeOption[] = [];
  const repeatsEnabled = user?.mealPlanRepeats ?? false;

  if (isSubscriber && user && tab === "planner") {
    const plan = await getOrCreateWeeklyPlan(user, weekStartDate);
    const planDays = parseDays(plan.days);
    const allRefs = planDays.flatMap((d) => Object.values(d.slots)).filter((r) => r !== null);
    const recipeIds = allRefs.filter((r) => r.kind === "recipe").map((r) => r.recipeId);
    const ownMealIds = allRefs.filter((r) => r.kind === "own").map((r) => r.ownMealId);

    const [planRecipes, planOwnMeals, myOwnMeals, allRecipesList] = await Promise.all([
      prisma.recipe.findMany({ where: { id: { in: recipeIds } } }),
      prisma.ownMeal.findMany({ where: { id: { in: ownMealIds } } }),
      prisma.ownMeal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.recipe.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" } }),
    ]);
    const recipeById = new Map(planRecipes.map((r) => [r.id, r]));
    const ownMealById = new Map(planOwnMeals.map((m) => [m.id, m]));

    mealPlanDayViews = planDays.map((d) => ({
      day: d.day,
      status: d.status,
      slots: Object.fromEntries(
        MEAL_SLOTS.map((slot) => {
          const ref = d.slots[slot];
          if (!ref) return [slot, null];
          if (ref.kind === "recipe") {
            const r = recipeById.get(ref.recipeId);
            return r
              ? [slot, { kind: "recipe", refId: r.id, title: r.title, ingredientCount: r.ingredientProductIds.length }]
              : [slot, null];
          }
          const m = ownMealById.get(ref.ownMealId);
          if (!m) return [slot, null];
          const ingredientLines = m.ingredients.map((term) => ({
            label: term,
            weSell: Boolean(matchProductByName(term, allProducts)),
          }));
          return [slot, { kind: "own", refId: m.id, title: m.name, ingredientLines }];
        }),
      ) as DayView["slots"],
    }));

    ownMealOptions = myOwnMeals.map((m) => ({ id: m.id, name: m.name, ingredientCount: m.ingredients.length }));
    recipeOptions = allRecipesList.map((r) => ({ id: r.id, title: r.title, ingredientCount: r.ingredientProductIds.length }));
  }

  const tabHref = (id: Tab) => (id === "library" ? "/recipes" : `/recipes?tab=${id}`);

  // Search on the menu finds a recipe by any of its ingredients, not just its title.
  const nameBySlug = new Map(allProducts.map((p) => [p.slug, p.name]));
  const ingredientNames = Object.fromEntries(
    MENU.map((r) => [r.slug, [...r.basket.map((s) => nameBySlug.get(s) ?? s.replace(/-/g, " ")), ...r.elsewhere]]),
  );
  const initialMenuGoal = MENU_GOALS.some((g) => g.id === forParam) ? (forParam as MenuGoal) : null;

  const menuSection = (
    <section className="hm" aria-labelledby="menu-title">
      <div className="hm-wrap py-10 sm:py-14">
        {tier !== "guest" && (
          <div className="mb-8">
            <h2 id="menu-title" className="hm-h3 text-[1.6rem]!">
              This week&apos;s menu
            </h2>
            <p className="mt-1.5 text-[15px] text-[var(--hm-ink-2)]">Open a recipe for amounts, tools and steps, then add what it needs in one tap.</p>
          </div>
        )}
        <MenuBrowser
          recipes={user ? byGoal(menuCards) : menuCards}
          ingredientNames={ingredientNames}
          initialGoal={initialMenuGoal}
          savedIds={user ? Array.from(savedRecipeIds) : undefined}
          signedIn={Boolean(user)}
        />
      </div>
    </section>
  );

  // The ask, once the browsing has made the case: pick a goal, start there.
  const signUpBand = (
    <section className="hm" aria-labelledby="band-title">
      <div className="hm-wrap pb-16 sm:pb-24">
        <div className="rounded-[32px] bg-carbon px-6 py-10 text-paper-white sm:px-10 sm:py-14">
          <h2 id="band-title" className="hm-h2 max-w-[18ch]">
            Pick your recipes. We bring the produce.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-paper-white/75">
            Tell us what you&apos;re eating for and we&apos;ll plan the week around it: the recipes, and the fresh produce for them, delivered on your day.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MENU_GOALS.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/start?goal=${g.id}`}
                  className="group flex h-full flex-col justify-between gap-6 rounded-[22px] bg-paper-white/8 p-5 transition-colors hover:bg-paper-white/14"
                >
                  <span className="text-[17px] font-semibold">{g.label}</span>
                  <span className="flex items-center justify-between text-[13px] text-paper-white/70">
                    {menuCards.filter((r) => r.goal === g.id).length} recipes
                    <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 10h12M11 5l5 5-5 5" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );

  const librarySection = (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-heading-lg">More ideas</h2>
          <p className="mt-2 text-muted">
            {isFiltered
              ? `${recipes.length} of ${totalRecipes} recipes match.`
              : "Filter by what you are eating for."}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Link
          href="/recipes"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !isFiltered ? "bg-carbon text-white" : "border border-border hover:bg-sky-wash"
          }`}
        >
          All recipes
        </Link>
        {GOALS.map((g) => (
          <Link
            key={g.slug}
            href={`/recipes?goal=${g.slug}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              goal === g.slug ? "bg-carbon text-white" : "border border-border hover:bg-sky-wash"
            }`}
          >
            {GOAL_LABEL[g.slug] ?? g.label}
          </Link>
        ))}
        {user && (
          <Link href="/recipes/saved" className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-sky-wash">
            <Icon name="favourite" size={14} strokeWidth={1.75} />
            Saved{savedRecipeIds.size > 0 ? ` · ${savedRecipeIds.size}` : ""}
          </Link>
        )}
      </div>

      {ingredientProduct && (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
          Using {ingredientProduct.name}
          <Link href="/recipes" aria-label="Clear the ingredient filter" className="text-muted transition hover:text-foreground">
            <Icon name="close" size={16} />
          </Link>
        </p>
      )}

      {recipes.length === 0 ? (
        <div className="mt-10 border-t border-border py-16 text-center">
          <p className="text-lg font-semibold">Nothing matches that yet</p>
          <p className="mt-2 text-muted">Try another goal, or clear the filter to see everything.</p>
          <Link href="/recipes" className="mt-4 inline-block font-semibold text-carbon underline">
            Show all recipes
          </Link>
        </div>
      ) : (
        <RecipeLibrary
          recipes={recipes.map(
            (r): LibraryRecipe => ({
              id: r.id,
              slug: r.slug,
              title: r.title,
              summary: r.summary,
              instructions: r.membersOnly && !isSubscriber ? "" : r.instructions,
              methodLocked: r.membersOnly && !isSubscriber,
              ingredients: r.ingredientProductIds
                .map((id) => byId.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p))
                .map((p) => ({
                  productId: p.id,
                  name: p.name,
                  imageEmoji: p.imageEmoji,
                  cloudinaryPublicId: p.cloudinaryPublicId,
                  price: isSubscriber ? p.memberPrice : p.standardPrice,
                  have: activeBasketProductIds.has(p.id),
                })),
            }),
          )}
          isSubscriber={isSubscriber}
          signedIn={Boolean(user)}
          savedRecipeIds={savedRecipeIds}
        />
      )}
    </section>
  );

  const plannerSection = (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {isSubscriber ? (
        <WeeklyMealPlanBuilder
          days={mealPlanDayViews}
          deliveryDay={deliveryDay}
          deliveryLine={deliveryLine}
          repeatsEnabled={repeatsEnabled}
          ownMealOptions={ownMealOptions}
          recipeOptions={recipeOptions}
          weekOffset={weekOffset}
          weekLabel={weekLabel}
        />
      ) : (
        <MealPlanGate />
      )}
    </section>
  );

  const produceSection = (
    <section className={tier === "guest" ? "border-y border-border bg-sky-wash" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-heading-lg">{tier === "guest" ? "Not sure what to cook?" : "Your produce for the week"}</h2>
            <p className="mt-4 text-base text-muted">
              {tier === "guest"
                ? "Answer two questions and we will list the fruit and vegetables to buy for the week. Everything comes off our shelves, so the gaps go straight to your cart."
                : "Answer two questions and we will list the fruit and vegetables to buy, grouped by whether you eat it raw or cook it."}
            </p>
          </div>

          <ProductImage
            publicId={PLANNER_IMAGE_ID}
            alt="Unpacking oranges, bananas, kale and tomatoes from a paper bag"
            emoji="🧺"
            aspectRatio="4:3"
            className="aspect-4/3 w-full"
            rounded="rounded-card-lg"
            emojiClassName="text-7xl"
            sizes="(min-width: 1024px) 520px, 90vw"
          />
        </div>

        <div className="mt-12 space-y-6">
          <ProduceListTab
            defaultGoal={prefs?.primaryGoal ?? "general-wellness"}
            defaultServings={defaultServings}
            signedIn={Boolean(user)}
          />
        </div>
      </div>
    </section>
  );

  return (
    <div>
      {tier === "guest" ? (
        <section className="hm bg-[var(--hm-tint)]" aria-labelledby="recipes-title">
          <div className="hm-wrap grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <Eyebrow>Recipes</Eyebrow>
              <h1 id="recipes-title" className="hm-h2 max-w-[16ch]">
                Food worth cooking, from what&apos;s fresh this week.
              </h1>
              <p className="hm-lede mt-4 max-w-2xl">
                Bowls, wraps, salads and quick pans from around the world, rebuilt around Lagos produce. Every recipe shows what
                we bring, how much you need and how to cook it, step by step.
              </p>
            </div>
            <div className="hidden grid-cols-2 grid-rows-2 gap-3 lg:grid lg:h-[360px]" aria-hidden>
              {pickDishes(MENU, HERO_RECIPES).map((r, i) => (
                <div key={r.slug} className={`relative overflow-hidden rounded-[24px] ${i === 0 ? "row-span-2" : ""}`}>
                  <Image src={r.image} alt="" fill priority sizes="260px" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        // Personalization strip: an account already knows the customer, so
        // this replaces the marketing hero and trust badges entirely rather
        // than showing convincing copy to someone who's already convinced.
        <section className="hm relative overflow-hidden bg-[#d1eafd]" aria-labelledby="recipes-hello">
          {/* Three of this week's dishes, set down at a slight angle like plates on a table. */}
          <div aria-hidden className="pointer-events-none absolute top-1/2 right-[max(1.5rem,calc((100vw-1080px)/2))] hidden -translate-y-1/2 lg:flex">
            {HEADER_DISHES.map((r, i) => (
              <div
                key={r.slug}
                className={`relative h-36 w-36 overflow-hidden rounded-full shadow-[0_18px_30px_-16px_rgb(0_0_0/0.45)] ring-[6px] ring-[#d1eafd] ${i ? "-ml-10" : ""}`}
                style={{ rotate: `${[-8, 5, -3][i]}deg`, marginTop: `${[0, 36, -12][i]}px` }}
              >
                <Image src={r.image} alt="" fill sizes="144px" className="object-cover" />
              </div>
            ))}
          </div>

          {/* Three tiers, top to bottom: who it's for (a small label and the
              question), what's true this week (one quiet line), and where to
              go (the tabs). Ask Kachi is already in the header. */}
          <div className="hm-wrap relative py-7 sm:py-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-carbon/70">
                  <KachiMark className="h-5 w-5" />
                  Picked for you this week
                </p>
                <h1 id="recipes-hello" className="hm-h2 mt-3 max-w-[15ch]">
                  What are we cooking{firstName ? `, ${firstName}` : ""}?
                </h1>
              </div>
              <div aria-hidden className="mt-1 flex shrink-0 max-[359px]:hidden lg:hidden">
                {HEADER_DISHES.map((r, i) => (
                  <div
                    key={r.slug}
                    className={`relative h-11 w-11 overflow-hidden rounded-full ring-[3px] ring-[#d1eafd] ${i ? "-ml-3.5" : ""}`}
                    style={{ rotate: `${[-8, 5, -3][i]}deg`, marginTop: `${[0, 14, 4][i]}px` }}
                  >
                    <Image src={r.image} alt="" fill sizes="44px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* What the week is tuned to, as one line rather than a pile of stickers. */}
            <p className="mt-3 text-[15px] leading-relaxed text-carbon/70">
              {[
                `${menuCards.length} recipes`,
                prefs?.primaryGoal ? (GOAL_LABEL[prefs.primaryGoal] ?? prefs.primaryGoal).toLowerCase() : null,
                prefs?.householdType ? `for ${HOUSEHOLD_TYPE_LABEL[prefs.householdType]?.toLowerCase() ?? prefs.householdType}` : null,
              ]
                .filter(Boolean)
                .join(", ")}
              {deliveryLine && (
                <>
                  <span aria-hidden> · </span>
                  {deliveryLine}
                </>
              )}
            </p>

            {/* Three-tab shell (Basket vs. Cart addendum, Section 2): All
                recipes, Meal plan, Produce list. Guests never see this:
                they keep the single scrolling page below. */}
            <nav aria-label="Recipes sections" className="mt-6 flex w-full max-w-md rounded-full bg-paper-white/70 p-1 sm:w-fit">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={tabHref(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`flex h-10 flex-1 items-center justify-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors sm:flex-none ${
                    tab === t.id ? "bg-carbon text-paper-white" : "text-carbon/65 hover:text-carbon"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
      )}

      {tier === "guest" ? (
        <>
          {menuSection}
          {signUpBand}
          {produceSection}
        </>
      ) : (
        <>
          {tab === "library" && (
            <>
              {menuSection}
              {(recipes.length > 0 || isFiltered) && librarySection}
            </>
          )}
          {tab === "planner" && plannerSection}
          {tab === "produce" && produceSection}
        </>
      )}
    </div>
  );
}
