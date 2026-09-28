import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { GOALS } from "@/lib/assistant";
import { GOAL_LABEL, HOUSEHOLD_TYPE_LABEL } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { ProducePlanner } from "./produce-planner";
import { RecipeAssistant } from "./recipe-assistant";
import { SaveRecipeButton } from "./save-recipe-button";
import { WeeklyMealPlanBuilder, type MealPlanRecipeInfo } from "./weekly-meal-plan";
import { sendRecipeIngredientsToBasket, addRecipeToMealPlan } from "./meal-plan-actions";
import { IdeasSheetTrigger } from "@/app/basket/ideas-sheet-trigger";
import { loadSavedProducePlans, SavedProducePlans } from "./produce-plan-history";
import { readGuestPlannerUsesLeft } from "@/lib/planner-cap";
import { getActiveBasketReadOnly, getBasketView } from "@/lib/basket";
import {
  getOrCreateWeeklyPlan,
  weekStartWithOffset,
  parseDays,
  MEAL_PLAN_DAYS,
  type MealPlanDayEntry,
} from "@/lib/weekly-meal-plan";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";

export const metadata = { title: "Recipes. Basket" };

const HERO_IMAGE_ID = "basket-recipes-hero-salad";
const PLANNER_IMAGE_ID = "basket-recipes-unpacking";

const SERVINGS_BY_HOUSEHOLD: Record<string, number> = {
  myself: 1,
  partner: 2,
  "family-kids": 4,
  housemates: 3,
  mixed: 3,
};

type Tab = "library" | "planner" | "produce";
const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "planner", label: "Meal Planner" },
  { id: "produce", label: "Produce Planner" },
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
  const defaultServings = prefs?.householdType
    ? SERVINGS_BY_HOUSEHOLD[prefs.householdType] ?? 3
    : 3;
  const initialUsesLeft = user ? null : await readGuestPlannerUsesLeft();

  const isFiltered = Boolean(goal || ingredientProduct || isSavedFilter);

  // Active basket contents, used by the personalization strip's basket-aware
  // line and the weekly plan's "already have" counts — subscribers only, per
  // the Recipes-by-tier addendum, Section 2.
  let activeBasketProductIds = new Set<string>();
  let basketShipDayLabel: string | null = null;
  if (isSubscriber && user) {
    const activeBasket = await getActiveBasketReadOnly(user.id);
    if (activeBasket) {
      const view = await getBasketView(activeBasket.id);
      activeBasketProductIds = new Set((view?.basket.items ?? []).map((i) => i.productId));
      basketShipDayLabel = activeBasket.shoppingWindowDay
        ? SHOPPING_WINDOW_DAY_LABEL[activeBasket.shoppingWindowDay]
        : null;
    }
  }

  // Weekly meal plan: a real, persisted plan for a subscriber; a read-only
  // shell built from ordinary recipes for a free account, never saved to
  // that account (Section 1 defaults to no free preview). Only fetched when
  // it's actually going to be shown, to keep the other two tabs cheap.
  let mealPlanDays: MealPlanDayEntry[] = [];
  const mealPlanRecipeInfo: Record<string, MealPlanRecipeInfo> = {};
  const showMealPlanner = tier === "guest" || tab === "planner";

  if (showMealPlanner) {
    if (isSubscriber && user) {
      const plan = await getOrCreateWeeklyPlan(user, weekStartDate);
      mealPlanDays = parseDays(plan.days);
      const recipeIds = mealPlanDays.map((d) => d.recipeId).filter((id): id is string => Boolean(id));
      const planRecipes = await prisma.recipe.findMany({ where: { id: { in: recipeIds } } });
      for (const r of planRecipes) {
        const missing = r.ingredientProductIds.filter((id) => !activeBasketProductIds.has(id));
        mealPlanRecipeInfo[r.id] = {
          title: r.title,
          ingredientCount: r.ingredientProductIds.length,
          missingCount: missing.length,
        };
      }
    } else {
      // Shell content for the locked preview (free accounts and guests) —
      // everyone still sees the shape of the feature (Section 1).
      const shellRecipes = await prisma.recipe.findMany({ take: 7, orderBy: { title: "asc" } });
      mealPlanDays = MEAL_PLAN_DAYS.map((day, i) => ({
        day,
        recipeId: shellRecipes[i % shellRecipes.length]?.id ?? null,
        suggestion: null,
        status: "PLANNED",
      }));
      for (const r of shellRecipes) {
        mealPlanRecipeInfo[r.id] = { title: r.title, ingredientCount: r.ingredientProductIds.length, missingCount: 0 };
      }
    }
  }

  const savedPlans = user && tab === "produce" ? await loadSavedProducePlans(user) : [];

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
        <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => {
            const ingredients = r.ingredientProductIds
              .map((id) => byId.get(id))
              .filter((p): p is NonNullable<typeof p> => Boolean(p));
            const steps = r.instructions.split("\n").filter(Boolean).length;
            const haveCount = isSubscriber
              ? r.ingredientProductIds.filter((id) => activeBasketProductIds.has(id)).length
              : 0;

            return (
              <li key={r.id} className="relative">
                <SaveRecipeButton recipeId={r.id} initialSaved={savedRecipeIds.has(r.id)} signedIn={Boolean(user)} />
                <Link href={`/recipes/${r.slug}`} className="group block">
                  <div className="flex items-center">
                    {ingredients.slice(0, 4).map((p, i) => (
                      <ProductImage
                        key={p.id}
                        publicId={p.cloudinaryPublicId}
                        alt={p.name}
                        emoji={p.imageEmoji}
                        className={`h-16 w-16 ring-2 ring-paper-white transition group-hover:ring-sky-wash ${i > 0 ? "-ml-4" : ""}`}
                        rounded="rounded-full"
                        emojiClassName="text-2xl"
                        sizes="64px"
                      />
                    ))}
                    {ingredients.length > 4 && (
                      <span className="-ml-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-wash text-sm font-semibold text-carbon ring-2 ring-paper-white">
                        +{ingredients.length - 4}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 text-lg font-bold group-hover:underline">{r.title}</h3>

                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                    <span>{ingredients.length} ingredients</span>
                    <span aria-hidden>·</span>
                    <span>{steps} {steps === 1 ? "step" : "steps"}</span>
                    {isSubscriber && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-medium text-carbon">You have {haveCount} of {ingredients.length}</span>
                      </>
                    )}
                  </p>

                  <p className="mt-3 text-base text-muted">{r.summary}</p>
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {isSubscriber && haveCount < ingredients.length && (
                    <form action={sendRecipeIngredientsToBasket.bind(null, r.id)}>
                      <button type="submit" className="text-sm font-semibold text-carbon underline">
                        Send missing items to basket
                      </button>
                    </form>
                  )}
                  {isSubscriber && (
                    <form action={addRecipeToMealPlan.bind(null, r.id)}>
                      <button type="submit" className="text-sm font-semibold text-carbon underline">
                        Add to plan
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const plannerSection = (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <WeeklyMealPlanBuilder
        locked={!isSubscriber}
        days={mealPlanDays}
        recipes={mealPlanRecipeInfo}
        shipDayLabel={basketShipDayLabel}
        weekOffset={weekOffset}
        weekLabel={weekLabel}
      />
    </section>
  );

  const produceSection = (
    <section className={tier === "guest" ? "border-y border-border bg-sky-wash" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-heading-lg">{tier === "guest" ? "Not sure what to cook?" : "Produce Planner"}</h2>
            <p className="mt-4 text-base text-muted">
              {tier === "guest"
                ? "Tell the planner what you already have, or what you are eating for, and it returns ideas for the week. Everything it suggests comes off our shelves, so you can add the gaps to your basket in one go."
                : "Training is only half of it. What about your diet, and the quality of the nutrition you get? Tell us the goal and household, and we will build a produce list for the week."}
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
          <RecipeAssistant defaultServings={defaultServings} servingsKnown={Boolean(prefs?.householdType)} />
          <ProducePlanner defaultServings={defaultServings} initialUsesLeft={initialUsesLeft} signedIn={Boolean(user)} />
          {user && <SavedProducePlans plans={savedPlans} isSubscriber={isSubscriber} />}
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

            {/* Three-tab shell (Basket vs. Cart addendum, Section 2): Library,
                Meal Planner, Produce Planner. Guests never see this — they
                keep the single scrolling page below, unchanged. */}
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
