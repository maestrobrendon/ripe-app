/**
 * Runs a Prisma CLI command against the PRODUCTION database, on purpose:
 *
 *   npm run db:status:prod          # what's applied in production
 *   npm run db:deploy:prod          # apply reviewed migrations to production
 *
 * Everything else (migrate dev, studio, seed) targets the development
 * database, basket_dev. See prisma.config.ts for how the target is chosen.
 * Works the same in every shell, Windows included.
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node prisma/scripts/with-prod.mjs <prisma args>");
  process.exit(1);
}
if (args[0] === "migrate" && ["dev", "reset"].includes(args[1])) {
  console.error(`Refusing "prisma migrate ${args[1]}" on production: it can drop data. Use migrate deploy.`);
  process.exit(1);
}

console.log(`\n>>> PRODUCTION database: prisma ${args.join(" ")}\n`);
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PRISMA_TARGET: "prod" },
});
process.exit(result.status ?? 1);
