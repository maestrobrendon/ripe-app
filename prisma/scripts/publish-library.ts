/**
 * Publishes the recipe library (prisma/data/library.json) on /recipes.
 *
 *   npm run library:publish              # development
 *   npm run library:publish -- --prod    # production (PROD_DATABASE_URL)
 *
 * - Every library draft with a photo becomes PUBLISHED. It stays off the
 *   homepage menu (onMenu is left alone); /recipes lists it.
 * - A recipe without a photo stays a draft: /recipes doesn't show one anyway.
 * - Recipes the library dropped (drinks, soups, plantain-led plates) are not
 *   in library.json's recipes, so they stay drafts.
 * - Published and menu recipes get the library's newer fields (category,
 *   nutrition, source, health tagline) where they don't have them yet. Their
 *   title, method and ingredients don't change.
 * - Reports recipes that use a product customers can't buy right now (hidden),
 *   so they can be priced and shown.
 * Safe to run again.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const prod = process.argv.includes("--prod");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL isn't set in .env.local.");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  throw new Error("DATABASE_URL points at production. Use --prod deliberately.");
}

type LibraryRecipe = {
  slug: string;
  category: string | null;
  subtype: string | null;
  serveWith: string | null;
  sourceSite: string | null;
  sourceUrl: string | null;
  referenceImageUrl: string | null;
  nutrition: object | null;
  healthTagline: string | null;
  alsoStrongIn: string | null;
  healthNote: string | null;
};

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { audit } = await import("../../src/lib/admin/audit");
  const library = (await import("../data/library.json")).default as unknown as { recipes: LibraryRecipe[] };
  const bySlug = new Map(library.recipes.map((r) => [r.slug, r]));

  const rows = await prisma.recipe.findMany({
    where: { slug: { in: [...bySlug.keys()] } },
    select: { id: true, slug: true, status: true, image: true, category: true, basketSlugs: true },
  });

  let published = 0;
  let filled = 0;
  const noPhoto: string[] = [];
  for (const row of rows) {
    const lib = bySlug.get(row.slug)!;
    if (row.status === "DRAFT") {
      if (!row.image) {
        noPhoto.push(row.slug);
        continue;
      }
      await prisma.recipe.update({ where: { id: row.id }, data: { status: "PUBLISHED" } });
      published++;
    }
    if (row.category === null) {
      await prisma.recipe.update({
        where: { id: row.id },
        data: {
          category: lib.category,
          subtype: lib.subtype,
          serveWith: lib.serveWith,
          sourceSite: lib.sourceSite,
          sourceUrl: lib.sourceUrl,
          referenceImageUrl: lib.referenceImageUrl,
          nutrition: lib.nutrition ?? undefined,
          healthTagline: lib.healthTagline,
          alsoStrongIn: lib.alsoStrongIn,
          healthNote: lib.healthNote,
        },
      });
      filled++;
    }
  }

  // Ingredients customers can't add to a basket yet.
  const hidden = new Set(
    (await prisma.product.findMany({ where: { availability: "HIDDEN" }, select: { slug: true } })).map((p) => p.slug),
  );
  const live = await prisma.recipe.findMany({ where: { status: "PUBLISHED", slug: { in: [...bySlug.keys()] } }, select: { slug: true, basketSlugs: true } });
  const blocked = live.map((r) => ({ slug: r.slug, hidden: r.basketSlugs.filter((s) => hidden.has(s)) })).filter((r) => r.hidden.length);
  const hiddenUsed = [...new Set(blocked.flatMap((r) => r.hidden))].sort();

  const summary =
    `Library published: ${published} recipes published, ${filled} given the library's newer fields, ` +
    `${noPhoto.length} left as drafts for want of a photo, ${live.length} library recipes now published. ` +
    `${blocked.length} use a hidden product (${hiddenUsed.join(", ") || "none"}).`;
  await audit({ actorType: "SYSTEM", action: "recipes.library_published", summary });
  console.log(`${prod ? "PRODUCTION" : "Development"}: ${summary}`);
  if (noPhoto.length) console.log(`No photo: ${noPhoto.join(", ")}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
