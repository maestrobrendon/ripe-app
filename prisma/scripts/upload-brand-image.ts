/**
 * One-off: upload a brand image (not a product photo) to Cloudinary and print
 * the public id to reference in code. Run locally only, never in the app runtime.
 *
 *   npx tsx prisma/scripts/upload-brand-image.ts <file> <public-id>
 *
 * Needs CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local (git-ignored).
 * The secret is read only here and never ships to the client.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "dusynu0kv";
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = "Brand";

async function main() {
  const [file, publicId] = process.argv.slice(2);
  if (!KEY || !SECRET) {
    console.error("Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local first.");
    process.exit(1);
  }
  if (!file || !publicId) {
    console.error("Usage: npx tsx prisma/scripts/upload-brand-image.ts <file> <public-id>");
    process.exit(1);
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Cloudinary signs the upload params in alphabetical order, secret appended.
  const toSign = `asset_folder=${FOLDER}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + SECRET).digest("hex");

  const bytes = await readFile(file);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)]), basename(file));
  form.set("api_key", KEY);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("asset_folder", FOLDER);
  form.set("overwrite", "true");
  form.set("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${body}`);

  const data = JSON.parse(body) as {
    public_id: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  };
  console.log("\nUploaded.");
  console.log(`  public_id : ${data.public_id}`);
  console.log(`  dimensions: ${data.width}x${data.height} ${data.format}`);
  console.log(`  size      : ${Math.round(data.bytes / 1024)} KB`);
  console.log(`  url       : ${data.secure_url}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
