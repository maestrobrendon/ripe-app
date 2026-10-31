import "server-only";
import { createHash, randomBytes } from "node:crypto";

/*
 * Photos customers send Kachi. A photo in a chat ("what can I make with
 * this?") goes to the model with that one message and is never stored. Only
 * a photo sent with a problem report is kept: uploaded to Cloudinary as an
 * authenticated (private) image, so it opens only through the signed link we
 * save on the report, never from a guessable address.
 */

/** Phones shrink photos before sending (see the chat), so anything bigger is refused. */
const MAX_BYTES = 2_000_000;
type PhotoType = "image/jpeg" | "image/png" | "image/webp";

export type Photo = { mediaType: PhotoType; data: Uint8Array; dataUrl: string };

/** A photo from the chat, as a data: URL, or null if it isn't one we take. */
export function readPhoto(value: unknown): Photo | null {
  if (typeof value !== "string" || value.length > MAX_BYTES * 1.4) return null;
  const m = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const data = Uint8Array.from(Buffer.from(m[2], "base64"));
  if (!data.length || data.length > MAX_BYTES) return null;
  return { mediaType: m[1] as PhotoType, data, dataUrl: value };
}

/** Uploads a report photo privately; returns its signed link, or null without Cloudinary keys or on failure. */
export async function uploadIssuePhoto(photo: Photo, orderId: string): Promise<string | null> {
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!key || !secret || !cloud) return null;
  const folder = process.env.CLOUDINARY_FOLDER || "Fruits_Veggie";
  const params: Record<string, string> = {
    public_id: `${folder}/issues/${orderId}-${randomBytes(6).toString("hex")}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: "authenticated",
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append("file", photo.dataUrl);
  form.append("api_key", key);
  form.append("signature", createHash("sha1").update(toSign + secret).digest("hex"));
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    const json = (await res.json()) as { secure_url?: string; error?: { message: string } };
    if (!json.secure_url) throw new Error(json.error?.message ?? `status ${res.status}`);
    return json.secure_url;
  } catch (err) {
    console.error(JSON.stringify({ scope: "issue-photo-upload", orderId, error: String(err).slice(0, 200) }));
    return null;
  }
}

/** Same for every customer, so it sits in the cached part of Kachi's instructions. */
export const PHOTO_RULES = `Photos:
- When they send a photo, say briefly what you see, then help with it. Food or a fridge: suggest what to make (recipes from the library first) and what they'd need to add. Produce that arrived bruised, wrong or not fresh: offer to report it.
- A photo they sent in the last few minutes goes with any problem you report, so the team can see it. You don't need to ask them to send it again.
- If you can't tell what's in a photo, say so and ask, rather than guessing.`;
