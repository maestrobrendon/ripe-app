import type { ProductCategory } from "@/generated/prisma/client";

/**
 * Pure logic for building a customer's first standing basket from their
 * onboarding answers. No database imports, so the onboarding preview screen can
 * run it client-side. The DB wrapper lives in `src/lib/starter-basket.ts`.
 * Goal seeds mirror the trained assistant's goal plans in `src/lib/assistant.ts`.
 */

export type StarterAnswers = {
  goalSlug: string | null;
  producePreferences: string[];
  adults: number;
  kids: number;
};

export type StarterCandidate = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  minOrderQty: number;
  stepQty: number;
  memberPrice: number;
  standardPrice: number;
  featured: boolean;
  inSeason: boolean;
};

export type StarterPick = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  memberPrice: number;
  standardPrice: number;
};

const STARTER_SEED: Record<string, { box: string; produce: string[] }> = {
  "post-workout-recovery": { box: "recovery-box", produce: ["banana", "watermelon", "sweet-potato", "spinach"] },
  "family-household": { box: "breakfast-box", produce: ["pawpaw", "banana", "avocado", "orange"] },
  "general-wellness": { box: "weekly-staples-box", produce: ["ugu", "spinach", "tomato", "orange", "apple"] },
  "weight-management": { box: "weekly-staples-box", produce: ["cucumber", "cabbage", "carrot", "tomato", "watermelon"] },
};

const DEFAULT_SEED = STARTER_SEED["general-wellness"];

/** Slugs a goal-less basket seeds from, before the featured/in-season padding. */
export const DEFAULT_SEED_SLUGS: string[] = [DEFAULT_SEED.box, ...DEFAULT_SEED.produce];

export function householdScale(adults: number, kids: number): number {
  return Math.max(1, Math.round((adults || 1) + 0.5 * (kids || 0)));
}

function snap(quantity: number, minOrderQty: number, stepQty: number): number {
  const above = Math.max(0, quantity - minOrderQty);
  return minOrderQty + Math.ceil(above / stepQty) * stepQty;
}

function preferredCategories(producePreferences: string[]): Set<ProductCategory> | null {
  if (producePreferences.length === 0 || producePreferences.includes("everything")) return null;
  const cats = new Set<ProductCategory>();
  for (const pref of producePreferences) {
    if (pref === "fruits") {
      cats.add("FRUIT");
      cats.add("SEASONAL");
    } else {
      // vegetables, leafy-greens, root-veg, herbs all live under VEGETABLE.
      cats.add("VEGETABLE");
    }
  }
  return cats;
}

export function buildStarterPicks(answers: StarterAnswers, candidates: StarterCandidate[]): StarterPick[] {
  const seed = (answers.goalSlug && STARTER_SEED[answers.goalSlug]) || DEFAULT_SEED;
  const scale = householdScale(answers.adults, answers.kids);
  const prefCats = preferredCategories(answers.producePreferences);
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));

  const chosen: { c: StarterCandidate; rawQty: number }[] = [];
  const taken = new Set<string>();

  const add = (c: StarterCandidate, units: number) => {
    if (taken.has(c.id)) return;
    taken.add(c.id);
    chosen.push({ c, rawQty: c.minOrderQty * units });
  };

  const box = bySlug.get(seed.box);
  if (box) add(box, scale >= 3 ? 2 : 1);

  for (const slug of seed.produce) {
    const c = bySlug.get(slug);
    if (!c) continue;
    if (prefCats && !prefCats.has(c.category)) continue;
    add(c, scale);
  }

  // If preference filtering left the basket thin, fall back to the full goal list.
  if (chosen.length < 4) {
    for (const slug of seed.produce) {
      const c = bySlug.get(slug);
      if (c) add(c, scale);
    }
  }

  // Pad with featured, in-season produce from the preferred categories.
  if (chosen.length < 6) {
    const pad = candidates
      .filter(
        (c) =>
          !taken.has(c.id) &&
          c.category !== "BOX_BUNDLE" &&
          c.featured &&
          c.inSeason &&
          (!prefCats || prefCats.has(c.category)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const c of pad) {
      if (chosen.length >= 6) break;
      add(c, scale);
    }
  }

  return chosen.map(({ c, rawQty }) => ({
    productId: c.id,
    slug: c.slug,
    name: c.name,
    quantity: c.category === "BOX_BUNDLE" ? rawQty : snap(rawQty, c.minOrderQty, c.stepQty),
    imageEmoji: c.imageEmoji,
    cloudinaryPublicId: c.cloudinaryPublicId,
    memberPrice: c.memberPrice,
    standardPrice: c.standardPrice,
  }));
}
