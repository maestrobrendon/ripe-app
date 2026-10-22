import "server-only";
import { createHash, randomBytes } from "node:crypto";

/*
 * Signed, direct-to-Cloudinary image uploads for the admin. The server signs
 * one upload (fixed folder, image formats only, a fresh public id); the
 * browser sends the file straight to Cloudinary, and our API secret never
 * leaves the server. Saved ids are checked to be from our own folder.
 */

const CLOUD = () => process.env.CLOUDINARY_CLOUD_NAME || "dusynu0kv";
const FOLDER = () => process.env.CLOUDINARY_FOLDER || "Fruits_Veggie";

export type SignedUpload = { url: string; fields: Record<string, string> };

/** Null when the server has no Cloudinary keys. `kind` keeps products and recipes apart. */
export function signImageUpload(kind: "products" | "recipes", name: string): SignedUpload | null {
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!key || !secret) return null;
  const base = kind === "products" ? FOLDER() : `${FOLDER()}/recipes`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
  const params: Record<string, string> = {
    allowed_formats: "jpg,jpeg,png,webp",
    asset_folder: base,
    public_id: `${base}/${slug}-${randomBytes(4).toString("hex")}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + secret).digest("hex");
  return { url: `https://api.cloudinary.com/v1_1/${CLOUD()}/image/upload`, fields: { ...params, api_key: key, signature } };
}

/** A public id from one of our upload folders (what signImageUpload hands out). */
export function isOurPublicId(id: string, kind: "products" | "recipes"): boolean {
  const base = kind === "products" ? FOLDER() : `${FOLDER()}/recipes`;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}/[a-z0-9-]+$`).test(id);
}

/** The delivery URL for an uploaded image. */
export function cloudinaryUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD()}/image/upload/f_auto,q_auto,c_fill,w_1200/${publicId}`;
}
