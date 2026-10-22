/**
 * The founder's basket model (Oct 18 2026), applied to existing data.
 * Idempotent: running it twice changes nothing the second time.
 *
 *   npx tsx --conditions=react-server prisma/scripts/basket-model-data.ts          # dev
 *   npx tsx --conditions=react-server prisma/scripts/basket-model-data.ts --prod   # production
 *
 * - Every area we deliver to runs Thursday, Friday and Saturday (staff can
 *   change any area's days in the admin afterwards).
 * - Baskets and customers on a day that's gone move to the nearest new day.
 * - A member's baskets repeat every week; a free account's basket is a trial
 *   that delivers once.
 * - No soups or stews: the soup box is hidden and those recipes unpublished.
 * - The plans' perks describe the model as it is.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { DeliveryDay } from "../../src/generated/prisma/enums";
import { dbConnectionString } from "../../src/lib/db-url";

const prod = process.argv.includes("--prod");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL isn't set in .env.local.");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  throw new Error("DATABASE_URL points at production. Use --prod deliberately.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbConnectionString() }) });

const DAYS: DeliveryDay[] = ["THURSDAY", "FRIDAY", "SATURDAY"];
const MOVE: Partial<Record<DeliveryDay, DeliveryDay>> = { MONDAY: "SATURDAY", TUESDAY: "THURSDAY", WEDNESDAY: "THURSDAY", SUNDAY: "SATURDAY" };

const TIERS: Record<string, { tagline: string; perks: string[] }> = {
  base: {
    tagline: "Your baskets, every week, at member prices.",
    perks: [
      "Baskets that come every week: up to 3, each on its own day",
      "Member prices on all produce, close to what we pay for it",
      "Reminders on WhatsApp, email and the app before every delivery",
      "Confirm in a tap and pay when it arrives. Nothing is charged automatically",
      "Change, skip or pause any week",
      "Every recipe, with the method",
    ],
  },
  premium: {
    tagline: "Everything in Member, plus free delivery and first pick of the season.",
    perks: [
      "Everything in Member",
      "Free delivery on every basket",
      "As many baskets as you like",
      "Early access to seasonal produce, like agbalumo and mango season",
      "Priority support on WhatsApp",
    ],
  },
};

async function main() {
  const zones = await prisma.deliveryZone.updateMany({ where: { isServed: true }, data: { deliveryDays: DAYS } });

  let baskets = 0;
  let users = 0;
  for (const [from, to] of Object.entries(MOVE) as [DeliveryDay, DeliveryDay][]) {
    baskets += (await prisma.basket.updateMany({ where: { deliveryDay: from }, data: { deliveryDay: to } })).count;
    users += (await prisma.user.updateMany({ where: { deliveryDay: from }, data: { deliveryDay: to } })).count;
  }

  const repeating = await prisma.basket.updateMany({ where: { isStanding: false, user: { subscriptionTierId: { not: null } } }, data: { isStanding: true } });
  const trials = await prisma.basket.updateMany({ where: { isStanding: true, user: { subscriptionTierId: null } }, data: { isStanding: false } });

  const soupBox = await prisma.product.updateMany({ where: { slug: "soup-box", availability: { not: "HIDDEN" } }, data: { availability: "HIDDEN", inSeason: false, featured: false } });
  const soups = await prisma.recipe.updateMany({ where: { slug: { in: ["efo-riro", "pepper-soup-veg"] }, status: "PUBLISHED" }, data: { status: "DRAFT", onMenu: false } });

  let tiers = 0;
  for (const [slug, t] of Object.entries(TIERS)) tiers += (await prisma.subscriptionTier.updateMany({ where: { slug }, data: t })).count;

  console.log(
    `${prod ? "PRODUCTION" : "Development"}: ${zones.count} areas on Thu/Fri/Sat, ${baskets} baskets and ${users} customers moved to a new day, ${repeating.count} member baskets set to repeat, ${trials.count} free baskets made trials, ${soupBox.count} soup box hidden, ${soups.count} soup/stew recipes unpublished, ${tiers} plans updated.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
