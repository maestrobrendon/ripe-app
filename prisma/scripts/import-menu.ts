/**
 * Loads the original menu (prisma/data) into the Recipe table, once. After
 * that, recipes are edited in the admin, so this never overwrites a recipe
 * that already exists unless --force is given.
 *
 *   npm run menu:import            # development database
 *   npm run menu:import -- --prod  # production (PROD_DATABASE_URL)
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

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { MENU } = await import("../data/menu");
  const { MENU_DETAILS } = await import("../data/menu-details");
  const { MENU_GOALS } = await import("../../src/lib/menu-types");

  // The older features (meal plan, basket assistant) read product ids.
  const products = await prisma.product.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(products.map((p) => [p.slug, p.id]));

  let created = 0;
  let updated = 0;
  let kept = 0;
  for (const [i, r] of MENU.entries()) {
    const detail = MENU_DETAILS[r.slug];
    const starter = MENU_GOALS.find((g) => g.id === r.goal)?.starterSlug;
    const data = {
      title: r.title,
      summary: r.hook,
      goal: r.goal,
      goalTags: starter ? [starter] : [],
      minutes: r.minutes,
      serves: r.serves,
      image: r.image,
      imageAlt: r.alt,
      basketSlugs: r.basket,
      ingredientProductIds: r.basket.map((s) => idBySlug.get(s)).filter((id): id is string => Boolean(id)),
      elsewhere: r.elsewhere,
      steps: r.steps,
      instructions: r.steps.join("\n"),
      amounts: detail ? (detail.amounts as unknown as object) : undefined,
      tools: detail?.tools ?? [],
      onMenu: true,
      status: "PUBLISHED" as const,
      sortOrder: (i + 1) * 10,
    };
    const existing = await prisma.recipe.findUnique({ where: { slug: r.slug }, select: { id: true } });
    if (existing && !force) {
      kept++;
      continue;
    }
    if (existing) {
      await prisma.recipe.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.recipe.create({ data: { slug: r.slug, ...data } });
      created++;
    }
  }
  console.log(`${prod ? "PRODUCTION" : "Development"}: ${created} created, ${updated} updated, ${kept} left as they were.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
