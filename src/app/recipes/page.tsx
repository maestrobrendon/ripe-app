import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { GOALS } from "@/lib/assistant";
import { GOAL_LABEL } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { ProducePlanner } from "./produce-planner";
import { IdeasSheetTrigger } from "@/app/basket/ideas-sheet-trigger";

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

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; ingredient?: string }>;
}) {
  const { goal, ingredient } = await searchParams;

  const [user, allProducts] = await Promise.all([getCurrentUser(), prisma.product.findMany()]);
  const bySlug = new Map(allProducts.map((p) => [p.slug, p]));
  const byId = new Map(allProducts.map((p) => [p.id, p]));

  const ingredientProduct = ingredient ? bySlug.get(ingredient) : null;

  const [recipes, totalRecipes] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        ...(goal ? { goalTags: { has: goal } } : {}),
        ...(ingredientProduct ? { ingredientProductIds: { has: ingredientProduct.id } } : {}),
      },
      orderBy: { title: "asc" },
    }),
    prisma.recipe.count(),
  ]);

  const prefs = user?.preferences;
  const defaultServings = prefs?.householdType
    ? SERVINGS_BY_HOUSEHOLD[prefs.householdType] ?? 3
    : 3;

  const isFiltered = Boolean(goal || ingredientProduct);

  return (
    <div>
      {/* Hero: what this page is for, and the one rule that makes it different */}
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

            {user && (
              <div className="mt-7">
                <IdeasSheetTrigger
                  className="tap-target inline-flex items-center gap-1.5 rounded-full border border-carbon px-4 py-2 text-sm font-semibold text-carbon hover:bg-white"
                  label="Get ideas for your basket"
                />
              </div>
            )}
          </div>

          <ProductImage
            publicId={HERO_IMAGE_ID}
            alt="Tossing a salad of kale, tomatoes and cucumber beside a bag of produce"
            emoji="🥗"
            aspectRatio="4:3"
            className="aspect-[4/3] w-full"
            rounded="rounded-card-lg"
            emojiClassName="text-8xl"
            sizes="(min-width: 1024px) 560px, 90vw"
          />
        </div>
      </section>

      {/* Library: filters, then cards that say what a recipe involves up front */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
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
              !isFiltered
                ? "bg-carbon text-white"
                : "border border-border hover:bg-sky-wash"
            }`}
          >
            All recipes
          </Link>
          {GOALS.map((g) => (
            <Link
              key={g.slug}
              href={`/recipes?goal=${g.slug}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                goal === g.slug
                  ? "bg-carbon text-white"
                  : "border border-border hover:bg-sky-wash"
              }`}
            >
              {GOAL_LABEL[g.slug] ?? g.label}
            </Link>
          ))}
        </div>

        {ingredientProduct && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
            Using {ingredientProduct.name}
            <Link
              href="/recipes"
              aria-label="Clear the ingredient filter"
              className="text-muted transition hover:text-foreground"
            >
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

              return (
                <li key={r.id}>
                  <Link href={`/recipes/${r.slug}`} className="group block">
                    {/* The produce itself is the picture: real photography of
                        the first few ingredients, overlapped into a stack. */}
                    <div className="flex items-center">
                      {ingredients.slice(0, 4).map((p, i) => (
                        <ProductImage
                          key={p.id}
                          publicId={p.cloudinaryPublicId}
                          alt={p.name}
                          emoji={p.imageEmoji}
                          className={`h-16 w-16 ring-2 ring-paper-white transition group-hover:ring-sky-wash ${
                            i > 0 ? "-ml-4" : ""
                          }`}
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
                    </p>

                    <p className="mt-3 text-base text-muted">{r.summary}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The planner, given its own room and a plain explanation of the job it does */}
      <section className="border-y border-border bg-sky-wash">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-heading-lg">Not sure what to cook?</h2>
              <p className="mt-4 text-base text-muted">
                Tell the planner what you already have, or what you are eating for, and it returns
                ideas for the week. Everything it suggests comes off our shelves, so you can add the
                gaps to your basket in one go.
              </p>
            </div>

            <ProductImage
              publicId={PLANNER_IMAGE_ID}
              alt="Unpacking oranges, bananas, kale and tomatoes from a paper bag"
              emoji="🧺"
              aspectRatio="4:3"
              className="aspect-[4/3] w-full"
              rounded="rounded-card-lg"
              emojiClassName="text-7xl"
              sizes="(min-width: 1024px) 520px, 90vw"
            />
          </div>

          <div className="mt-12">
            <ProducePlanner defaultServings={defaultServings} />
          </div>
        </div>
      </section>
    </div>
  );
}
