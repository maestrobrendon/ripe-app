/**
 * One-off: fold the three membership plans into two (October 2026).
 *
 *   npx tsx prisma/scripts/two-tiers.ts
 *
 * Upserts "base" (Member, ₦4,500) and "premium" (Member Plus, ₦8,500) from
 * prisma/tiers.ts, moves anyone on the retired "mid" plan to "base", then
 * deletes "mid". Safe to run twice: the second run finds no "mid".
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { dbConnectionString } from "../../src/lib/db-url";
import { tiers } from "../tiers";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbConnectionString() }) });

async function main() {
  for (const tier of tiers) {
    await prisma.subscriptionTier.upsert({ where: { slug: tier.slug }, update: tier, create: tier });
  }
  const base = await prisma.subscriptionTier.findUniqueOrThrow({ where: { slug: "base" } });
  const mid = await prisma.subscriptionTier.findUnique({ where: { slug: "mid" } });
  if (mid) {
    const moved = await prisma.user.updateMany({ where: { subscriptionTierId: mid.id }, data: { subscriptionTierId: base.id } });
    await prisma.subscriptionTier.delete({ where: { id: mid.id } });
    console.log(`Moved ${moved.count} member(s) from Mid to Member and removed Mid.`);
  } else {
    console.log("No Mid plan left; tiers refreshed.");
  }
  const now = await prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, monthlyFee: true, _count: { select: { users: true } } } });
  console.log(JSON.stringify(now));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
