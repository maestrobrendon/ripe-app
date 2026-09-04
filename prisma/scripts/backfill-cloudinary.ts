/**
 * One-off: match Cloudinary assets in the Fruits_Veggie folder to products and
 * set Product.cloudinaryPublicId. Run locally only, never in the app runtime.
 *
 *   CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... npx tsx prisma/scripts/backfill-cloudinary.ts
 *
 * The API secret stays in your shell / .env.local and never ships to the client.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { dbConnectionString } from "../../src/lib/db-url";

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "dusynu0kv";
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER || "Fruits_Veggie";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbConnectionString() }) });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

function score(a: Set<string>, b: Set<string>): number {
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / Math.max(1, Math.min(a.size, b.size));
}

async function listFolder(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/by_asset_folder`);
    url.searchParams.set("asset_folder", FOLDER);
    url.searchParams.set("max_results", "100");
    if (cursor) url.searchParams.set("next_cursor", cursor);
    const res = await fetch(url, {
      headers: { Authorization: "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64") },
    });
    if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { resources: { public_id: string }[]; next_cursor?: string };
    ids.push(...data.resources.map((r) => r.public_id));
    cursor = data.next_cursor;
  } while (cursor);
  return ids;
}

async function main() {
  if (!KEY || !SECRET) {
    console.error("Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (in .env.local or the shell).");
    process.exit(1);
  }

  const [publicIds, products] = await Promise.all([listFolder(), prisma.product.findMany()]);
  if (publicIds.length === 0) {
    console.log(`No assets found in folder "${FOLDER}".`);
    return;
  }
  console.log(`Found ${publicIds.length} assets, ${products.length} products.`);

  let matched = 0;
  for (const product of products) {
    const target = tokens(`${product.slug} ${product.name}`);
    let best: { id: string; s: number } | null = null;
    for (const id of publicIds) {
      const fileTokens = tokens(id.split("/").pop() ?? id);
      const s = score(target, fileTokens);
      if (!best || s > best.s) best = { id, s };
    }
    if (best && best.s >= 0.5) {
      await prisma.product.update({ where: { id: product.id }, data: { cloudinaryPublicId: best.id } });
      console.log(`  ${product.slug}  ->  ${best.id}  (${best.s.toFixed(2)})`);
      matched += 1;
    } else {
      console.log(`  ${product.slug}  ->  no confident match`);
    }
  }
  console.log(`Set ${matched} / ${products.length} product images.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
