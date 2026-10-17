import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Small, audited building blocks for the admin's security code. Everything
 * here is node:crypto only: no third-party crypto.
 */

/** 32 random bytes, URL-safe. For session tokens, invite tokens, CSRF tokens. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored as their sha256, never in the clear. */
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Constant-time string comparison (lengths may differ; that leaks only length). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/*
 * Field encryption at rest (TOTP secrets): AES-256-GCM with a random 96-bit
 * IV per value and the 128-bit auth tag. Key from ADMIN_ENC_KEY, 32 bytes as
 * base64. Format: "v1.<iv>.<tag>.<ciphertext>", each part base64url. The
 * version prefix allows key rotation later (v2 = new key) without ambiguity.
 */
const VERSION = "v1";

function key(raw = process.env.ADMIN_ENC_KEY): Buffer {
  if (!raw) throw new Error("ADMIN_ENC_KEY is not set");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("ADMIN_ENC_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function encrypt(plaintext: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string, rawKey?: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unrecognised ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
