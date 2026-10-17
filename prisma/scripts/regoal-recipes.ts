/**
 * Moves recipes onto the six goals (Oct 2026: "Just eat better" was replaced
 * by busy weeks, more plants and fresh fruit). Safe to re-run.
 *
 * - The photographed menu: two recipes per goal, so every goal has dishes to
 *   pick in sign-up and on the homepage.
 * - Library drafts (prisma/data/library.json): the goal derived from the sheet.
 *   Only drafts off the menu are touched, so nothing published changes.
 *
 *   npx tsx --conditions=react-server prisma/scripts/regoal-recipes.ts [--prod]
 */
import { config } from "dotenv";
import type { MenuGoal } from "../../src/lib/menu-types";
config({ path: ".env.local", quiet: true });

const prod = process.argv.includes("--prod");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL isn't set in .env.local.");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  throw new Error("DATABASE_URL points at production. Use --prod deliberately.");
}

const MENU_GOAL: Record<string, MenuGoal> = {
  "chicken-shawarma-bowl": "lighter",
  "mushroom-spinach-frittata": "lighter",
  "sweet-potato-burrito-bowl": "training",
  "suya-beef-lettuce-wraps": "training",
  "garden-egg-shakshuka": "family",
  "grilled-fish-pepper-salsa": "family",
  "avocado-dodo-toast": "busy",
  "ginger-vegetable-stir-fry": "busy",
  "green-mango-crunch-salad": "plants",
  "beetroot-orange-salad": "plants",
  "mango-passion-smoothie-bowl": "fruit",
  "watermelon-cucumber-salad": "fruit",
};

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { audit } = await import("../../src/lib/admin/audit");
  const { MENU_GOALS } = await import("../../src/lib/menu-types");
  const library = (await import("../data/library.json")).default as unknown as { recipes: { slug: string; goal: MenuGoal }[] };
  const tagsFor = (g: MenuGoal) => [MENU_GOALS.find((x) => x.id === g)!.starterSlug];

  let menu = 0;
  for (const [slug, goal] of Object.entries(MENU_GOAL)) {
    const r = await prisma.recipe.updateMany({ where: { slug }, data: { goal, goalTags: tagsFor(goal) } });
    menu += r.count;
  }
  let drafts = 0;
  for (const { slug, goal } of library.recipes) {
    if (slug in MENU_GOAL) continue;
    const r = await prisma.recipe.updateMany({ where: { slug, status: "DRAFT", onMenu: false }, data: { goal, goalTags: tagsFor(goal) } });
    drafts += r.count;
  }
  const leftover = await prisma.recipe.count({ where: { goal: "everyday" } });

  const summary = `Recipes moved to the six goals: ${menu} menu recipes, ${drafts} library drafts. ${leftover} still on the old "everyday" goal.`;
  await audit({ actorType: "SYSTEM", action: "recipes.goals_updated", summary });
  console.log(`${prod ? "PRODUCTION" : "Development"}: ${summary}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
