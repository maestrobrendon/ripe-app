import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/*
 * TOTP (RFC 6238 over RFC 4226 HOTP): 6 digits, 30-second steps, HMAC-SHA1,
 * which is what every authenticator app supports. Tested against the RFC's
 * own vectors in totp.test.ts.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 (what authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP for one counter value. `digits` and `algorithm` are exposed for the RFC tests. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac(algorithm, secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const counterAt = (unixSeconds: number) => Math.floor(unixSeconds / STEP_SECONDS);

/**
 * Checks a code against the current step and one either side (clock drift).
 * Returns the matching counter, so the caller can store it and refuse the
 * same or an older counter next time: a code works once.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  { now = Date.now() / 1000, lastUsedCounter = -1, window = 1 }: { now?: number; lastUsedCounter?: number; window?: number } = {},
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = counterAt(now);
  let match: number | null = null;
  // Check every candidate (no early exit) so timing doesn't reveal which step matched.
  for (let c = current - window; c <= current + window; c++) {
    if (c <= lastUsedCounter) continue;
    const expected = hotp(secret, c);
    let diff = 0;
    for (let i = 0; i < DIGITS; i++) diff |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    if (diff === 0 && match === null) match = c;
  }
  return match;
}

/** The otpauth:// URI an authenticator app scans as a QR code. */
export function otpauthUri(secretBase32: string, account: string, issuer = "Basket Admin"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params}`;
}
