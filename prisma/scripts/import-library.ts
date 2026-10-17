/**
 * Loads the Produce & Recipe Library (docs/Basket_Produce_and_Recipe_Library.xlsx,
 * exported to prisma/data/library.json) into the catalogue and the Recipe table.
 *
 * - Products the sheet has that the catalogue doesn't are created hidden, like
 *   a new product in the admin, so they can be priced and finished before
 *   anyone sees them. Products that already exist are left alone.
 * - Recipes are created as drafts, off the menu, for review in the admin.
 *   A recipe whose slug already exists is left alone unless --force is given.
 * - Basket does no drink recipes, so any published drink recipe still in the
 *   table goes back to draft.
 *
 *   npm run library:import            # development database
 *   npm run library:import -- --prod  # production (PROD_DATABASE_URL)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const prod = process.argv.includes("--prod");
const force = process.argv.includes("--force");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL isn't set in .env.local.");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  throw new Error("DATABASE_URL points at production. Use --prod deliberately.");
}

type LibraryProduct = {
  sheetId: string;
  slug: string;
  name: string;
  category: "FRUIT" | "VEGETABLE" | "SEASONAL";
  unit: string;
  price: number;
  imageEmoji: string;
  source: string;
  description: string | null;
  storageTips: string | null;
};

type LibraryRecipe = {
  sheetId: string;
  slug: string;
  title: string;
  summary: string;
  goal: "lighter" | "training" | "family" | "everyday";
  minutes: number;
  serves: number;
  basketSlugs: string[];
  elsewhere: string[];
  amounts: Record<string, [number, string]>;
  steps: string[];
  sortOrder: number;
};

/** Slugs of drink recipes from before the library dropped them. */
const DRINK_SLUGS = ["pineapple-ginger-smoothie"];

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { audit } = await import("../../src/lib/admin/audit");
  const { MENU_GOALS } = await import("../../src/lib/menu-types");
  const library = (await import("../data/library.json")).default as unknown as { products: LibraryProduct[]; recipes: LibraryRecipe[] };

  let productsCreated = 0;
  let productsKept = 0;
  for (const p of library.products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing) {
      productsKept++;
      continue;
    }
    const created = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        category: p.category,
        unit: p.unit,
        orderUnit: "PIECE",
        soldAs: "SINGLE",
        // The sheet's Basket price is still blank, so the competitor benchmark
        // (or 0 where there isn't one) holds the place until staff price it.
        standardPrice: p.price,
        memberPrice: p.price,
        source: p.source,
        imageEmoji: p.imageEmoji,
        description: p.description,
        storageTips: p.storageTips,
        availability: "HIDDEN",
        inSeason: false,
      },
    });
    await prisma.priceChange.createMany({
      data: (["standardPrice", "memberPrice"] as const).map((field) => ({
        productId: created.id,
        field,
        fromValue: null,
        toValue: p.price,
        reason: "Imported from the produce library (placeholder until priced)",
        staffName: "Library import",
      })),
    });
    productsCreated++;
  }

  const products = await prisma.product.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(products.map((p) => [p.slug, p.id]));

  let recipesCreated = 0;
  let recipesUpdated = 0;
  let recipesKept = 0;
  for (const r of library.recipes) {
    const missing = r.basketSlugs.filter((s) => !idBySlug.has(s));
    if (missing.length) throw new Error(`${r.slug} uses products that don't exist: ${missing.join(", ")}`);
    const starter = MENU_GOALS.find((g) => g.id === r.goal)?.starterSlug;
    const data = {
      title: r.title,
      summary: r.summary,
      goal: r.goal,
      goalTags: starter ? [starter] : [],
      minutes: r.minutes,
      serves: r.serves,
      basketSlugs: r.basketSlugs,
      ingredientProductIds: r.basketSlugs.map((s) => idBySlug.get(s)!),
      elsewhere: r.elsewhere,
      steps: r.steps,
      instructions: r.steps.join("\n"),
      amounts: r.amounts,
      tools: [],
      onMenu: false,
      membersOnly: false,
      status: "DRAFT" as const,
      sortOrder: r.sortOrder,
    };
    const existing = await prisma.recipe.findUnique({ where: { slug: r.slug }, select: { id: true } });
    if (existing && !force) {
      recipesKept++;
      continue;
    }
    if (existing) {
      await prisma.recipe.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } });
      recipesUpdated++;
    } else {
      await prisma.recipe.create({ data: { slug: r.slug, ...data } });
      recipesCreated++;
    }
  }

  const drinks = await prisma.recipe.updateMany({ where: { slug: { in: DRINK_SLUGS }, status: "PUBLISHED" }, data: { status: "DRAFT", onMenu: false } });

  const summary = `Library import: ${productsCreated} products created hidden (${productsKept} already existed), ${recipesCreated} draft recipes created, ${recipesUpdated} updated, ${recipesKept} left as they were, ${drinks.count} drink recipe(s) moved to draft.`;
  await audit({ actorType: "SYSTEM", action: "catalogue.library_imported", summary });
  console.log(`${prod ? "PRODUCTION" : "Development"}: ${summary}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
