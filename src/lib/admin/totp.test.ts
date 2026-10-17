import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, otpauthUri, verifyTotp } from "./totp";

// RFC 6238 Appendix B: secret "12345678901234567890", 8 digits, SHA1.
const RFC_SECRET = Buffer.from("12345678901234567890");
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP", () => {
  it("matches the RFC 6238 SHA1 test vectors", () => {
    for (const [t, code] of RFC_VECTORS) expect(hotp(RFC_SECRET, Math.floor(t / 30), 8)).toBe(code);
  });

  it("matches RFC 4226 HOTP vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code));
  });

  it("round-trips base32", () => {
    const buf = Buffer.from("12345678901234567890");
    expect(base32Encode(buf)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("accepts the current code and one step of drift, nothing further", () => {
    const secret = base32Encode(RFC_SECRET);
    const now = 1111111111;
    const code = (t: number) => hotp(RFC_SECRET, Math.floor(t / 30));
    expect(verifyTotp(secret, code(now), { now })).toBe(Math.floor(now / 30));
    expect(verifyTotp(secret, code(now - 30), { now })).not.toBeNull();
    expect(verifyTotp(secret, code(now + 30), { now })).not.toBeNull();
    expect(verifyTotp(secret, code(now - 90), { now })).toBeNull();
  });

  it("refuses a code that was already used (replay)", () => {
    const secret = base32Encode(RFC_SECRET);
    const now = 1111111111;
    const code = hotp(RFC_SECRET, Math.floor(now / 30));
    const used = verifyTotp(secret, code, { now })!;
    expect(verifyTotp(secret, code, { now, lastUsedCounter: used })).toBeNull();
  });

  it("rejects malformed input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "12345")).toBeNull();
    expect(verifyTotp(secret, "abcdef")).toBeNull();
    expect(verifyTotp(secret, "1234567")).toBeNull();
  });

  it("makes 160-bit secrets and a scannable URI", () => {
    const s = generateTotpSecret();
    expect(base32Decode(s)).toHaveLength(20);
    expect(otpauthUri(s, "a@b.co")).toMatch(/^otpauth:\/\/totp\/Basket%20Admin%3Aa%40b\.co\?secret=/);
  });
});
