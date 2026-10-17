import "server-only";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { normalizePhone, phoneVariants } from "@/lib/phone";

const scryptAsync = promisify(scrypt);

// Password hashing with Node's built-in scrypt, so there is no extra dependency.
// A real deployment would move this behind an auth provider.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "hex");
  return keyBuffer.length === derived.length && timingSafeEqual(keyBuffer, derived);
}

export function normalizeContact(raw: string): { email?: string; phone?: string } {
  const value = raw.trim();
  if (value.includes("@")) return { email: value.toLowerCase() };
  const phone = normalizePhone(value);
  return phone ? { phone } : {};
}

/**
 * The account lookup for "email or phone". A phone matches however an older
 * account stored it (0803…, 234803…, +234803…), so nobody is locked out by
 * the switch to one stored format.
 */
export function contactWhere(raw: string) {
  const { email, phone } = normalizeContact(raw);
  if (email) return { email };
  if (phone) return { phone: { in: phoneVariants(raw) } };
  return null;
}
