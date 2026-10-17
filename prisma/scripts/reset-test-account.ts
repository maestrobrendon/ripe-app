/**
 * Local only: wipe a test account so the signup flow can be walked again with
 * the same address, and optionally recreate it so sign-in can be tested too.
 *
 *   npm run test:reset          # delete the account, /start is fresh again
 *   npm run test:seed           # delete, then recreate it ready to sign in
 *   npx tsx prisma/scripts/reset-test-account.ts other@example.com
 *
 * Reads TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD from .env.local, which is
 * git-ignored, so no personal address or password lands in the repository.
 * Refuses to run against a production environment.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { dbConnectionString } from "../../src/lib/db-url";
import { hashPassword, normalizeContact } from "../../src/lib/auth";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbConnectionString() }) });

const SEED = process.argv.includes("--seed");
const emailArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const RAW = emailArg || process.env.TEST_ACCOUNT_EMAIL || "";
const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD || "basket-test-1234";
const NAME = process.env.TEST_ACCOUNT_NAME || "Test Account";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run with NODE_ENV=production. This deletes an account.");
    process.exit(1);
  }
  if (!RAW) {
    console.error("No address given. Set TEST_ACCOUNT_EMAIL in .env.local or pass one as an argument.");
    process.exit(1);
  }

  // Match however signup stored it, so an address typed either way is found.
  const { email, phone } = normalizeContact(RAW);
  const user = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
  });

  if (!user) {
    console.log(`No account for ${RAW}. Nothing to delete.`);
  } else {
    // Carts, baskets, orders and windows do not cascade from User, so they go
    // first; their line items and the session/preference rows cascade.
    const [windows, baskets, carts, orders] = await prisma.$transaction([
      prisma.shoppingWindow.deleteMany({ where: { userId: user.id } }),
      prisma.basket.deleteMany({ where: { userId: user.id } }),
      prisma.cart.deleteMany({ where: { userId: user.id } }),
      prisma.order.deleteMany({ where: { userId: user.id } }),
    ]);
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`Deleted ${user.email ?? user.phone} (created ${user.createdAt.toISOString().slice(0, 10)})`);
    console.log(
      `  ${orders.count} orders, ${baskets.count} baskets, ${carts.count} carts, ${windows.count} windows, plus sessions and preferences.`,
    );
  }

  if (SEED) {
    const created = await prisma.user.create({
      data: {
        name: NAME,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash: await hashPassword(PASSWORD),
        onboardingCompleted: true,
      },
      select: { email: true, phone: true },
    });
    console.log(`\nRecreated ${created.email ?? created.phone}`);
    console.log(`  password: ${PASSWORD}`);
    console.log("  Sign in at /login.");
  } else {
    console.log("\n/start will now take this address as a new signup.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
