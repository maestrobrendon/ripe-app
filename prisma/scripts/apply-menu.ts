/**
 * The homepage menu and the recipe order, from the v2 library (30 Oct 2026).
 *
 *   npm run menu:apply              # development
 *   npm run menu:apply -- --prod    # production (PROD_DATABASE_URL)
 *
 * "Sell what people eat": the homepage shows dishes people in Lagos already
 * know and want, three per goal (MENU below). On /recipes they come first,
 * then the other familiar dishes, then the ones that look foreign at first
 * sight (FOREIGN), which are still there for anyone who scrolls.
 *
 * A pick goes on the menu only once its photo is in public/images/menu/
 * (<slug>.jpg or .webp); until then it waits as a draft. The old menu's
 * recipes come off the homepage and go back to draft: several broke the
 * library's rules (a smoothie bowl, a dodo toast, fish- and beef-led plates).
 * Safe to run again: it sets the same values each time.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const prod = process.argv.includes("--prod");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL isn't set in .env.local.");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  throw new Error("DATABASE_URL points at production. Use --prod deliberately.");
}

/** The homepage, three per goal, in the order each goal shows them (the first is the large card). */
const MENU: { goal: string; slugs: string[] }[] = [
  { goal: "lighter", slugs: ["nigerian-mixed-vegetable-sauce", "garden-egg-chopped-salad", "greek-salad-with-wara"] },
  { goal: "training", slugs: ["chicken-suya-power-bowl", "chicken-shawarma-salad-bowl", "boiled-yam-and-pepper-egg-sauce"] },
  { goal: "family", slugs: ["nigerian-salad-bowl", "vegetable-egg-sauce", "crunchy-groundnut-cabbage-slaw"] },
  { goal: "busy", slugs: ["nigerian-party-coleslaw-with-sweet-corn", "avocado-toast-with-ata-rodo-salsa", "tomato-and-egg-stir-fry"] },
  { goal: "plants", slugs: ["chunky-vegetable-stew-ata-dindin-style", "ugu-and-tatashe-greens-stew", "garlic-stir-fried-efo-tete"] },
  { goal: "fruit", slugs: ["nigerian-fruit-salad-with-condensed-milk", "chilli-lime-fruit-cup-yaji-edition", "fruit-skewers-with-yoghurt-dip"] },
];

/** Good dishes that read as foreign on first look: listed last. */
const FOREIGN = new Set([
  "menemen", "huevos-a-la-mexicana", "cherry-tomato-and-wara-scramble-strapatsada", "persian-tomato-omelette-with-turmeric",
  "israeli-breakfast-plate", "piperade-basque-pepper-base-with-eggs", "masala-omelette", "pan-con-tomate", "bruschetta-al-pomodoro",
  "kachumbari", "kachumbari-eggs", "ezme-turkish-chopped-tomato-and-pepper-spread", "pico-de-gallo", "roasted-salsa-roja",
  "tikil-gomen-cabbage-carrot-and-potato", "tabbouleh-herb-salad", "fattoush-with-agege-croutons", "caprese-salad",
  "sunomono-japanese-cucumber-salad", "kachumber-indian-chopped-salad", "shepherds-salad-coban-salatasi", "smashed-cucumber-salad",
  "green-pawpaw-salad", "moroccan-carrot-and-orange-salad", "lecso-hungarian-pepper-and-tomato-stew", "pepperonata",
  "matbucha-slow-cooked-tomato-and-tatashe-spread", "arrabbiata-sauce", "puttanesca-sauce", "briam-greek-baked-vegetables",
  "caribbean-creole-sauce", "bhuna-masala-onion-tomato-curry-base", "romesco-tatashe-and-groundnut-sauce", "panzanella",
  "bhindi-masala-stir-fried-okra", "garden-egg-ratatouille", "garden-egg-baba-ganoush", "okra-and-corn-succotash",
  "black-eyed-bean-falafel-bowl", "thai-groundnut-wara-bowl", "chickpea-and-efo-curry", "mediterranean-garden-egg-and-chickpea-bowl",
  "grilled-vegetable-couscous-bowl-with-yoghurt", "filipino-style-fruit-salad-with-cream", "bionico-mexican-fruit-bowl-with-sweet-cream",
  "indian-fruit-chaat", "thai-mango-with-coconut-cream", "winter-citrus-salad-with-mint-and-honey", "pineapple-carpaccio-with-mint-and-lime",
  "strawberries-with-balsamic-and-black-pepper", "roasted-grapes-with-yoghurt-and-basil", "mango-prawn-poke-style-bowl",
  "teriyaki-chicken-and-broccoli-bowl", "bibimbap-style-beef-bowl", "greek-chicken-gyro-bowl-with-tzatziki",
  "coconut-prawn-and-mango-rice-bowl", "fish-tacos-with-pineapple-salsa", "corn-tatashe-and-efo-quesadilla",
  "thai-green-curry-with-pumpkin-and-ugu", "caribbean-curry-chicken-and-sweet-potato", "kerala-style-okra-and-prawn-coconut-curry",
  "esquites-mexican-street-corn-cups", "mexican-street-corn-and-chicken-bowl", "lagos-nicoise", "coconut-chia-pudding-with-mango",
]);

/** The menu before this one. Off the homepage, back to draft. */
const OLD_MENU = [
  "chicken-shawarma-bowl", "green-mango-crunch-salad", "watermelon-cucumber-salad", "sweet-potato-burrito-bowl",
  "mango-passion-smoothie-bowl", "suya-beef-lettuce-wraps", "garden-egg-shakshuka", "ginger-vegetable-stir-fry",
  "grilled-fish-pepper-salsa", "avocado-dodo-toast", "beetroot-orange-salad", "mushroom-spinach-frittata",
];

/** The pick's photo, if it's in place. */
function photo(slug: string): string | null {
  for (const ext of ["jpg", "webp"]) if (existsSync(path.join(process.cwd(), "public/images/menu", `${slug}.${ext}`))) return `/images/menu/${slug}.${ext}`;
  return null;
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  console.log(`Applying the menu to ${prod ? "PRODUCTION" : "development"}.`);

  const picks = MENU.flatMap((m, gi) => m.slugs.map((slug, i) => ({ slug, goal: m.goal, sortOrder: 10 + gi * 30 + i * 10 })));
  const pickSlugs = new Set(picks.map((p) => p.slug));

  const off = await prisma.recipe.updateMany({ where: { slug: { in: OLD_MENU.filter((s) => !pickSlugs.has(s)) } }, data: { onMenu: false, status: "DRAFT" } });
  console.log(`Old menu off the homepage: ${off.count}`);

  let live = 0;
  const waiting: string[] = [];
  for (const p of picks) {
    const image = photo(p.slug);
    const r = await prisma.recipe.findUnique({ where: { slug: p.slug }, select: { title: true } });
    if (!r) {
      waiting.push(`${p.slug} (not in the library)`);
      continue;
    }
    if (!image) {
      await prisma.recipe.update({ where: { slug: p.slug }, data: { sortOrder: p.sortOrder, goal: p.goal } });
      waiting.push(`${p.slug} (no photo yet)`);
      continue;
    }
    await prisma.recipe.update({
      where: { slug: p.slug },
      data: { onMenu: true, status: "PUBLISHED", sortOrder: p.sortOrder, goal: p.goal, image, imageAlt: r.title },
    });
    live++;
  }
  console.log(`On the homepage: ${live} of ${picks.length}`);
  if (waiting.length) console.log(`Waiting: ${waiting.join(", ")}`);

  // Everything else: familiar dishes from 1000, the foreign-looking ones from 5000,
  // each keeping the library's own order within its group.
  const rest = await prisma.recipe.findMany({
    where: { slug: { notIn: [...pickSlugs] }, sortOrder: { gte: 1000 } },
    select: { slug: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  let familiar = 0;
  let foreign = 0;
  for (const r of rest) {
    const isForeign = FOREIGN.has(r.slug);
    // The library's own position (1000-2650), whether or not a previous run moved it to 5000+.
    const base = r.sortOrder % 4000;
    const next = (isForeign ? 5000 : 1000) + (base - 1000);
    if (next !== r.sortOrder) await prisma.recipe.update({ where: { slug: r.slug }, data: { sortOrder: next } });
    if (isForeign) foreign++;
    else familiar++;
  }
  console.log(`Library order: ${familiar} familiar first, ${foreign} foreign-looking after.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
