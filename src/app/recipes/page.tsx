import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { GOALS } from "@/lib/assistant";
import { GOAL_LABEL, HOUSEHOLD_TYPE_LABEL } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { matchProductByName } from "@/lib/ingredient-match";
import { RecipeAssistant } from "./recipe-assistant";
import { RecipeLibrary, type LibraryRecipe } from "./recipe-library";
import { ProduceListTab } from "./produce-list-tab";
import { WeeklyMealPlanBuilder, MealPlanGate, type DayView, type MealOption, type RecipeOption } from "./weekly-meal-plan";
import { IdeasSheetTrigger } from "@/app/basket/ideas-sheet-trigger";
import { getActiveBasketReadOnly, getBasketView } from "@/lib/basket";
import { getOrCreateWeeklyPlan, weekStartWithOffset, parseDays, MEAL_SLOTS } from "@/lib/weekly-meal-plan";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";

export const metadata = { title: "Recipes. Basket" };

const HERO_IMAGE_ID = "basket-recipes-hero-salad";
const PLANNER_IMAGE_ID = "basket-recipes-unpacking";

type Tab = "library" | "planner" | "produce";
const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "All recipes" },
  { id: "planner", label: "Meal plan" },
  { id: "produce", label: "Produce list" },
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; goal?: string; ingredient?: string; saved?: string; week?: string }>;
}) {
  const { tab: tabParam, goal, ingredient, saved, week: weekParam } = await searchParams;

  const [user, allProducts] = await Promise.all([getCurrentUser(), prisma.product.findMany()]);
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
        ...(goal ? { goalTags: { has: goal } } : {}),
        ...(ingredientProduct ? { ingredientProductIds: { has: ingredientProduct.id } } : {}),
        ...(isSavedFilter ? { id: { in: Array.from(savedRecipeIds) } } : {}),
      },
      orderBy: { title: "asc" },
    }),
    prisma.recipe.count(),
  ]);

  const prefs = user?.preferences;
  // The one food-preferences record (Account > Food preferences): household
  // size is adults plus children on the user.
  const defaultServings = user ? user.householdAdults + user.householdKids : 3;

  const isFiltered = Boolean(goal || ingredientProduct || isSavedFilter);

  // Active basket contents, used by the personalization strip's basket-aware
  // line and the weekly plan's "already have" counts — subscribers only, per
  // the Recipes-by-tier addendum, Section 2.
  let activeBasketProductIds = new Set<string>();
  let basketShipDayLabel: string | null = null;
  let basketShipDay: ShoppingWindowDay | null = null;
  if (isSubscriber && user) {
    const activeBasket = await getActiveBasketReadOnly(user.id);
    if (activeBasket) {
      const view = await getBasketView(activeBasket.id);
      activeBasketProductIds = new Set((view?.basket.items ?? []).map((i) => i.productId));
      basketShipDay = activeBasket.shoppingWindowDay;
      basketShipDayLabel = activeBasket.shoppingWindowDay
        ? SHOPPING_WINDOW_DAY_LABEL[activeBasket.shoppingWindowDay]
        : null;
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
      prisma.recipe.findMany({ orderBy: { title: "asc" } }),
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

  const librarySection = (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-heading-lg">Recipe library</h2>
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
        {showSavedFilter && (
          <Link
            href="/recipes?saved=1"
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
              isSavedFilter ? "bg-carbon text-white" : "border border-border hover:bg-sky-wash"
            }`}
          >
            <Icon name="favourite" size={14} strokeWidth={1.75} />
            Saved
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
              instructions: r.instructions,
              ingredients: r.ingredientProductIds
                .map((id) => byId.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p))
                .map((p) => ({
                  productId: p.id,
                  name: p.name,
                  imageEmoji: p.imageEmoji,
                  cloudinaryPublicId: p.cloudinaryPublicId,
                  price: isSubscriber ? p.memberPrice : p.standardPrice,
                  have: isSubscriber && activeBasketProductIds.has(p.id),
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
          basketShipDay={basketShipDay}
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
            isSubscriber={isSubscriber}
          />
          {/* The escape hatch for anything the two-question list doesn't
              cover, same as the timetable's "or type your own": free-form,
              conversational, still produce-only. */}
          <RecipeAssistant defaultServings={defaultServings} servingsKnown={Boolean(user)} />
        </div>
      </div>
    </section>
  );

  return (
    <div>
      {tier === "guest" ? (
        <section className="bg-sky-wash">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="text-display-xl text-carbon">Cook what is in the bag</h1>
              <p className="mt-5 max-w-lg text-base text-carbon/80 sm:text-lg">
                Every recipe here is built from fruit and vegetables we actually stock, so the shopping
                list is one tap, not a separate errand.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  `${totalRecipes} recipes, all produce led`,
                  "Ingredients link straight to the shop",
                  "Food ideas, not medical advice",
                ].map((point) => (
                  <li key={point} className="flex items-center gap-3 text-carbon">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-carbon text-white">
                      <Icon name="check" size={15} strokeWidth={2} />
                    </span>
                    <span className="text-base">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ProductImage
              publicId={HERO_IMAGE_ID}
              alt="Tossing a salad of kale, tomatoes and cucumber beside a bag of produce"
              emoji="🥗"
              aspectRatio="4:3"
              className="aspect-4/3 w-full"
              rounded="rounded-card-lg"
              emojiClassName="text-8xl"
              sizes="(min-width: 1024px) 560px, 90vw"
            />
          </div>
        </section>
      ) : (
        // Personalization strip: an account already knows the customer, so
        // this replaces the marketing hero and trust badges entirely rather
        // than showing convincing copy to someone who's already convinced.
        <section className="border-b border-border bg-sky-wash">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-carbon">Suggestions tuned for you</p>
                <h1 className="mt-1 text-2xl font-semibold text-carbon">
                  {prefs?.primaryGoal ? GOAL_LABEL[prefs.primaryGoal] ?? prefs.primaryGoal : "Recipes"}
                  {prefs?.householdType && (
                    <span className="ml-2 text-base font-normal text-carbon/70">
                      for {HOUSEHOLD_TYPE_LABEL[prefs.householdType]?.toLowerCase() ?? prefs.householdType}
                    </span>
                  )}
                </h1>
                {isSubscriber && basketShipDayLabel && (
                  <p className="mt-2 text-sm text-carbon/80">
                    Your basket ships {basketShipDayLabel} — this week&rsquo;s plan is built to use what&rsquo;s
                    already in it where it can.
                  </p>
                )}
              </div>
              <IdeasSheetTrigger
                className="tap-target inline-flex items-center gap-1.5 rounded-full border border-carbon px-4 py-2 text-sm font-semibold text-carbon hover:bg-white"
                label="Get ideas for your basket"
              />
            </div>

            {/* Three-tab shell (Basket vs. Cart addendum, Section 2): All
                recipes, Meal plan, Produce list. Guests never see this —
                they keep the single scrolling page below, unchanged. */}
            <div className="mt-6 flex gap-1 border-b border-carbon/15">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={tabHref(t.id)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                    tab === t.id ? "border-carbon text-carbon" : "border-transparent text-carbon/60 hover:text-carbon"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {tier === "guest" ? (
        <>
          {librarySection}
          {plannerSection}
          {produceSection}
        </>
      ) : (
        <>
          {tab === "library" && librarySection}
          {tab === "planner" && plannerSection}
          {tab === "produce" && produceSection}
        </>
      )}
    </div>
  );
}
