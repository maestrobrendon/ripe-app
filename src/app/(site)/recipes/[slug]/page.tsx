import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getActiveBasketReadOnly, getBasketView } from "@/lib/basket";
import { ProductImage } from "@/components/product-image";
import { Clock, People, ShareMeter } from "@/app/(bare)/home-menu/parts/shared";
import { getRecipeView, getRelatedCards, MENU_GOAL_LABEL } from "../recipe-data";
import { RecipeCard } from "../recipe-card";
import { Ingredients } from "./ingredients";
import { CookSteps } from "./cook-steps";
import { RecipeCta } from "./recipe-cta";

// The recipe pages share the homepage's look: soft tints, photo first.
import "@/app/(bare)/home-menu/home-menu.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeView(slug, { isSubscriber: false });
  if (!recipe) return {};
  const description = `${recipe.hook} ${recipe.minutes ? `Ready in ${recipe.minutes} minutes. ` : ""}Get the fresh produce delivered with Basket.`;
  return {
    title: `${recipe.title} recipe. Basket`,
    description,
    openGraph: { title: recipe.title, description, images: recipe.image ? [{ url: recipe.image }] : undefined },
  };
}

const HOW = [
  { title: "Pick your recipes", body: "Tell us your goal and choose what you want to cook this week." },
  { title: "We bring the produce", body: "Everything fresh for those recipes arrives on your day, sized for your household." },
  { title: "Cook it step by step", body: "Every recipe has amounts, tools and steps you can tick off as you go." },
];

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const isSubscriber = Boolean(user?.subscriptionTierId);

  // A subscriber's recipe knows what's already coming in their basket.
  let basketProductIds: Set<string> | undefined;
  if (isSubscriber && user) {
    const active = await getActiveBasketReadOnly(user.id);
    const view = active ? await getBasketView(active.id) : null;
    basketProductIds = new Set((view?.basket.items ?? []).map((i) => i.productId));
  }

  const recipe = await getRecipeView(slug, { isSubscriber, basketProductIds });
  if (!recipe) notFound();
  const related = await getRelatedCards(recipe.slug, recipe.goal);

  const total = recipe.basket.length + recipe.elsewhere.length;
  const toGet = recipe.basket.filter((i) => !i.have);
  const startHref =
    recipe.source === "menu"
      ? `/start?goal=${recipe.goal}&recipe=${recipe.slug}`
      : recipe.goal
        ? `/start?goal=${recipe.goal}`
        : "/start";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.hook,
    image: recipe.image ? [recipe.image] : undefined,
    totalTime: recipe.minutes ? `PT${recipe.minutes}M` : undefined,
    recipeYield: recipe.serves ? `${recipe.serves} servings` : undefined,
    recipeIngredient: [...recipe.basket.map((i) => i.product.name), ...recipe.elsewhere.map((e) => e.label)],
    recipeInstructions: recipe.steps.map((text) => ({ "@type": "HowToStep", text })),
  };

  return (
    <div className="hm pb-28 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="hm-wrap pt-6 sm:pt-8">
        <nav aria-label="Breadcrumb" className="text-[14px] text-[var(--hm-ink-2)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/recipes" className="hover:text-carbon hover:underline">
                Recipes
              </Link>
            </li>
            {recipe.goal && (
              <>
                <li aria-hidden>/</li>
                <li>
                  <Link href={`/recipes?for=${recipe.goal}`} className="hover:text-carbon hover:underline">
                    {MENU_GOAL_LABEL[recipe.goal]}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden>/</li>
            <li aria-current="page" className="truncate font-medium text-carbon">
              {recipe.title}
            </li>
          </ol>
        </nav>

        {/* The hero: the photo, then everything you'd scan before deciding to cook it. */}
        <header className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12">
          {recipe.image ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[var(--hm-tint)]">
              <Image src={recipe.image} alt={recipe.alt} fill priority sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className={`grid aspect-[4/3] gap-3 rounded-[28px] bg-[var(--hm-tint)] p-6 ${recipe.basket.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`} aria-hidden>
              {recipe.basket.slice(0, 6).map(({ product }) => (
                <ProductImage
                  key={product.id}
                  publicId={product.cloudinaryPublicId}
                  alt=""
                  emoji={product.imageEmoji}
                  rounded="rounded-[20px]"
                  flavour="bg-paper-white"
                  emojiClassName="text-5xl"
                  sizes="180px"
                  className="h-full w-full"
                />
              ))}
            </div>
          )}

          <div>
            {recipe.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {recipe.tags.map((t) => (
                  <li key={t} className="inline-flex h-8 items-center rounded-full bg-[var(--hm-tint)] px-3 text-[13px] font-semibold text-[var(--hm-basket-ink)]">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <h1 className="hm-h2 mt-4">{recipe.title}</h1>
            <p className="hm-lede mt-4">{recipe.hook}</p>

            <dl className="mt-6 grid grid-cols-3 divide-x divide-[var(--hm-line)] rounded-[22px] bg-[var(--hm-tint)] py-4 text-center">
              <div className="px-2">
                <dt className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--hm-ink-2)]">
                  <Clock className="h-4 w-4" /> Time
                </dt>
                <dd className="mt-1 text-[16px] font-semibold">{recipe.minutes ? `${recipe.minutes} min` : "Quick"}</dd>
              </div>
              <div className="px-2">
                <dt className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--hm-ink-2)]">
                  <People className="h-4 w-4" /> Serves
                </dt>
                <dd className="mt-1 text-[16px] font-semibold">{recipe.serves ?? "2+"}</dd>
              </div>
              <div className="px-2">
                <dt className="text-[12px] font-medium text-[var(--hm-ink-2)]">Steps</dt>
                <dd className="mt-1 text-[16px] font-semibold">{recipe.steps.length}</dd>
              </div>
            </dl>

            <div className="mt-6">
              <ShareMeter have={recipe.basket.length} total={total} />
              <p className="mt-2 text-[14px] text-[var(--hm-ink-2)]">
                <b className="font-semibold text-carbon">
                  {recipe.basket.length} of {total}
                </b>{" "}
                ingredients come in your basket.{" "}
                <a href="#ingredients" className="font-semibold text-carbon underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
                  See them
                </a>
              </p>
            </div>
          </div>
        </header>

        {/* The recipe, with the ask beside it on wide screens. */}
        <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-[1fr_340px] lg:gap-14">
          <div className="min-w-0 space-y-14">
            <Ingredients basket={recipe.basket} elsewhere={recipe.elsewhere} serves={recipe.serves} showHave={isSubscriber} />
            <CookSteps slug={recipe.slug} steps={recipe.steps} products={recipe.basket.map((i) => i.product)} tools={recipe.tools} />
            <p className="text-[13px] text-[var(--hm-ink-3)]">This is a food idea, not nutritional or medical advice.</p>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <RecipeCta
              slug={recipe.slug}
              startHref={startHref}
              signedIn={Boolean(user)}
              isSubscriber={isSubscriber}
              fromBasket={recipe.basket.length}
              total={total}
              toGet={toGet.length}
              cost={toGet.reduce((sum, i) => sum + i.product.price, 0)}
            />
          </div>
        </div>
      </div>

      {!user && (
        <section className="mt-20 bg-[var(--hm-tint)] py-16 sm:py-20" aria-labelledby="how-title">
          <div className="hm-wrap">
            <h2 id="how-title" className="hm-h2 max-w-[22ch]">
              Cook this next week, without the market run.
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {HOW.map((s, i) => (
                <li key={s.title} className="rounded-[24px] bg-paper-white p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-mint-pop text-[15px] font-bold">{i + 1}</span>
                  <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.02em]">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--hm-ink-2)]">{s.body}</p>
                </li>
              ))}
            </ol>
            <Link
              href={startHref}
              className="mt-10 inline-flex h-13 items-center gap-2 rounded-full bg-carbon px-7 text-[15px] font-semibold text-paper-white transition hover:bg-carbon/85"
            >
              Start with this recipe
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 10h12M11 5l5 5-5 5" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className={`hm-wrap ${user ? "mt-20" : "mt-16"} pb-16 sm:pb-24`} aria-labelledby="more-title">
          <div className="flex items-end justify-between gap-4">
            <h2 id="more-title" className="hm-h3 text-[1.6rem]!">
              More like this
            </h2>
            <Link href="/recipes" className="shrink-0 text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
              Every recipe
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
