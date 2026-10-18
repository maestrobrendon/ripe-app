import Image from "next/image";
import Link from "next/link";
import { Clock, People, ShareMeter } from "@/app/(bare)/home-menu/parts/shared";
import type { RecipeCardView } from "./recipe-data";
import { SaveRecipeButton } from "./save-recipe-button";

/**
 * A menu recipe as a card that opens its page. The same anatomy as the
 * homepage menu card (photo, time on the photo, how much Basket covers), so a
 * recipe looks the same wherever someone meets it.
 */
export function RecipeCard({
  recipe,
  priority = false,
  large = false,
  save,
}: {
  recipe: RecipeCardView;
  priority?: boolean;
  large?: boolean;
  /** Show the save heart (signed-in pages). */
  save?: { saved: boolean; signedIn: boolean };
}) {
  const card = (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group hm-photo flex h-full flex-col overflow-hidden rounded-[26px] bg-[var(--hm-tint)] transition-shadow duration-(--dur-base) hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]"
    >
      <div className={`relative w-full overflow-hidden ${large ? "aspect-[4/3] lg:aspect-auto lg:flex-1" : "aspect-[4/3]"}`}>
        <Image
          src={recipe.image}
          alt={recipe.alt}
          fill
          priority={priority}
          sizes={large ? "(min-width: 1024px) 620px, 100vw" : "(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"}
          className="object-cover transition-transform duration-(--dur-slower) group-hover:scale-[1.03]"
        />
        <span className="absolute top-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-paper-white/92 px-3 text-[13px] font-semibold backdrop-blur-sm">
          <Clock className="h-4 w-4" />
          {recipe.minutes} min
        </span>
        <span className={`absolute top-3 inline-flex h-8 items-center rounded-full bg-carbon/80 px-3 text-[12px] font-semibold text-paper-white backdrop-blur-sm ${save && recipe.id ? "right-14" : "right-3"}`}>
          {recipe.goalLabel}
        </span>
      </div>
      <div className={`flex flex-1 flex-col gap-3 ${large ? "p-6 sm:p-7" : "p-5"}`}>
        <div>
          <h3 className={large ? "hm-h3" : "text-[17px] leading-snug font-semibold tracking-[-0.02em] group-hover:underline"}>{recipe.title}</h3>
          <p className={`mt-1.5 leading-relaxed text-[var(--hm-ink-2)] ${large ? "text-[15px]" : "line-clamp-2 text-[14px]"}`}>{recipe.hook}</p>
        </div>
        <div className="mt-auto">
          <ShareMeter have={recipe.fromBasket} total={recipe.total} />
          <p className="mt-2 flex items-center justify-between gap-3 text-[13px] font-medium text-[var(--hm-ink-2)]">
            <span>
              We bring{" "}
              <b className="font-semibold text-carbon">
                {recipe.fromBasket} of {recipe.total}
              </b>
            </span>
            <span className="inline-flex items-center gap-1">
              <People className="h-4 w-4" /> {recipe.serves}
            </span>
          </p>
        </div>
      </div>
    </Link>
  );
  if (!save || !recipe.id) return card;
  return (
    <div className="relative h-full [&>a]:h-full">
      {card}
      <div className="absolute top-1 right-1">
        <SaveRecipeButton recipeId={recipe.id} initialSaved={save.saved} signedIn={save.signedIn} />
      </div>
    </div>
  );
}
