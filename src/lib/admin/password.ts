import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/*
 * Staff passwords, NIST 800-63B style: length over composition rules, no
 * forced rotation, and a refusal of passwords known to be breached.
 *
 * Hash format "v2$<logN>$<r>$<p>$<salt>$<hash>" (base64url parts), so the
 * cost can be raised later and old hashes still verify. N = 2^17 is roughly
 * 100ms+ per guess on a server: fine for logins, expensive for an attacker.
 */

export const MIN_LENGTH = 12;
export const MAX_LENGTH = 128;
const LOG_N = 17;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function derive(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  const N = 2 ** logN;
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashStaffPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, LOG_N, R, P);
  return ["v2", LOG_N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyStaffPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "v2") return false;
  const [, logN, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), Number(logN), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** True when a stored hash uses weaker parameters than today's and should be re-hashed at next login. */
export function needsRehash(stored: string): boolean {
  const [v, logN, r, p] = stored.split("$");
  return v !== "v2" || Number(logN) < LOG_N || Number(r) !== R || Number(p) !== P;
}

/* ------------------------------ policy ----------------------------------- */

/** A floor for when the breach API is unreachable. The API is the real check. */
const COMMON = new Set(
  [
    "password", "password1", "password123", "123456789012", "qwertyuiop", "iloveyou", "admin", "administrator",
    "letmein", "welcome", "welcome123", "monkey", "dragon", "football", "baseball", "sunshine", "princess",
    "basket", "basketadmin", "getbasket", "lagos", "nigeria", "changeme", "passw0rd", "qwerty123", "abc123456789",
  ].map((s) => s.toLowerCase()),
);

export type PasswordProblem = "too_short" | "too_long" | "common" | "contains_email" | "breached";

export const PASSWORD_PROBLEM_TEXT: Record<PasswordProblem, string> = {
  too_short: `Use at least ${MIN_LENGTH} characters. A short sentence works well.`,
  too_long: `Keep it under ${MAX_LENGTH} characters.`,
  common: "That password is too common. Pick something only you would think of.",
  contains_email: "Don't build your password from your email address.",
  breached: "That password has appeared in a data breach elsewhere. Please choose a different one.",
};

/** Local checks only: synchronous, no network. */
export function checkPasswordLocally(password: string, email?: string): PasswordProblem | null {
  if (password.length < MIN_LENGTH) return "too_short";
  if (password.length > MAX_LENGTH) return "too_long";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || /^(0123456789|1234567890)+/.test(password)) return "common";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "contains_email";
  return null;
}

/**
 * Pwned Passwords k-anonymity check: only the first 5 hex characters of the
 * SHA-1 leave the server; the match happens here. Fails open (returns false)
 * if the service is slow or down, so an outage never blocks staff, and the
 * local checks still apply.
 */
export async function isBreached(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "basket-admin" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export async function checkPassword(password: string, email?: string, fetchImpl?: typeof fetch): Promise<PasswordProblem | null> {
  const local = checkPasswordLocally(password, email);
  if (local) return local;
  return (await isBreached(password, fetchImpl)) ? "breached" : null;
}
