import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", quiet: true });

/*
 * Which database the Prisma CLI (migrate, studio) talks to. Development by
 * default: .env.local's DATABASE_URL_UNPOOLED, the basket_dev database.
 * Production only when asked for by name, PRISMA_TARGET=prod (see the
 * db:*:prod scripts), so a migration can't reach live data by accident.
 * Migrations use the direct (unpooled) connection: the pooler can't run them.
 */
const target = process.env.PRISMA_TARGET === "prod" ? "prod" : "dev";
const url =
  target === "prod"
    ? process.env.PROD_DATABASE_URL_UNPOOLED
    : (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);

// A local-machine guard. On Vercel the production database is the right one
// (the build only runs `prisma generate`, which doesn't connect).
if (target === "dev" && !process.env.VERCEL && url && /\/neondb(\?|$)/.test(url)) {
  throw new Error("DATABASE_URL_UNPOOLED points at the production database. Use PRISMA_TARGET=prod for production on purpose.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
