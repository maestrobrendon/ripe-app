/**
 * One-off: match Cloudinary assets in the Fruits_Veggie folder to products and
 * set Product.cloudinaryPublicId. Run locally only, never in the app runtime.
 *
 *   npx tsx prisma/scripts/backfill-cloudinary.ts          # match + write
 *   npx tsx prisma/scripts/backfill-cloudinary.ts --list   # just print the folder
 *
 * Needs CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local (git-ignored).
 * The secret is read only here and never ships to the client.
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
const LIST_ONLY = process.argv.includes("--list");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbConnectionString() }) });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

function score(a: Set<string>, b: Set<string>): number {
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / Math.max(1, Math.min(a.size, b.size));
}

type Asset = { public_id: string; label: string; format: string };

async function listFolder(): Promise<Asset[]> {
  const out: Asset[] = [];
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
    const data = (await res.json()) as {
      resources: { public_id: string; display_name?: string; filename?: string; format: string }[];
      next_cursor?: string;
    };
    for (const r of data.resources) {
      out.push({
        public_id: r.public_id,
        label: r.display_name || r.filename || (r.public_id.split("/").pop() ?? r.public_id),
        format: r.format,
      });
    }
    cursor = data.next_cursor;
  } while (cursor);
  return out;
}

async function main() {
  if (!KEY || !SECRET) {
    console.error("Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local first.");
    process.exit(1);
  }

  const assets = await listFolder();
  console.log(`\n${assets.length} assets in "${FOLDER}":`);
  for (const a of assets) console.log(`  ${a.label.padEnd(28)} ${a.public_id}`);

  if (LIST_ONLY) return;

  const products = await prisma.product.findMany();
  const usedIds = new Set<string>();
  let matched = 0;

  for (const product of products) {
    const target = tokens(`${product.slug} ${product.name}`);
    let best: { a: Asset; s: number } | null = null;
    for (const a of assets) {
      const s = Math.max(score(target, tokens(a.label)), score(target, tokens(a.public_id)));
      if (!best || s > best.s) best = { a, s };
    }
    if (best && best.s >= 0.45) {
      await prisma.product.update({
        where: { id: product.id },
        data: { cloudinaryPublicId: best.a.public_id },
      });
      usedIds.add(best.a.public_id);
      console.log(`  MATCH  ${product.slug.padEnd(22)} -> ${best.a.label} (${best.s.toFixed(2)})`);
      matched += 1;
    } else {
      console.log(`  ----   ${product.slug.padEnd(22)} -> no confident match`);
    }
  }

  const unused = assets.filter((a) => !usedIds.has(a.public_id));
  console.log(`\nSet ${matched}/${products.length} product images.`);
  if (unused.length) {
    console.log(`\n${unused.length} Cloudinary assets not matched to any product (candidates for new products):`);
    for (const a of unused) console.log(`  ${a.label.padEnd(28)} ${a.public_id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
