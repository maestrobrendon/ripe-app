import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, safeEqual, sha256Hex } from "./crypto";
import { checkPassword, checkPasswordLocally, hashStaffPassword, isBreached, needsRehash, verifyStaffPassword } from "./password";
import { canonical, chainHash, GENESIS, redact, verifyChain, type ChainRow } from "./audit-chain";

const KEY = randomBytes(32).toString("base64");

describe("field encryption", () => {
  it("round-trips and never repeats ciphertext", () => {
    const a = encrypt("JBSWY3DPEHPK3PXP", KEY);
    const b = encrypt("JBSWY3DPEHPK3PXP", KEY);
    expect(a).not.toBe(b);
    expect(decrypt(a, KEY)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("detects tampering and the wrong key", () => {
    const c = encrypt("secret", KEY);
    const parts = c.split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 1;
    expect(() => decrypt([...parts.slice(0, 3), flipped.toString("base64url")].join("."), KEY)).toThrow();
    expect(() => decrypt(c, randomBytes(32).toString("base64"))).toThrow();
  });

  it("refuses a missing or short key", () => {
    expect(() => encrypt("x", "")).toThrow();
    expect(() => encrypt("x", randomBytes(16).toString("base64"))).toThrow();
  });

  it("compares in constant time and hashes", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("staff passwords", () => {
  it("hashes in the versioned format and verifies", async () => {
    const h = await hashStaffPassword("correct horse battery staple");
    expect(h).toMatch(/^v2\$17\$8\$1\$/);
    expect(await verifyStaffPassword("correct horse battery staple", h)).toBe(true);
    expect(await verifyStaffPassword("correct horse battery stapl", h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
    expect(needsRehash("v2$14$8$1$x$y")).toBe(true);
    expect(await verifyStaffPassword("anything", "salt:legacyhash")).toBe(false);
  }, 20000);

  it("enforces length, common and email rules", () => {
    expect(checkPasswordLocally("short")).toBe("too_short");
    expect(checkPasswordLocally("a".repeat(129))).toBe("too_long");
    expect(checkPasswordLocally("password123")).toBe("too_short");
    expect(checkPasswordLocally("aaaaaaaaaaaaaa")).toBe("common");
    expect(checkPasswordLocally("brendon-loves-mangoes", "brendon@basket.ng")).toBe("contains_email");
    expect(checkPasswordLocally("plantain at midnight, twice")).toBeNull();
  });

  it("matches breached passwords by suffix only and fails open", async () => {
    // sha1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const seen: string[] = [];
    const fake = (async (url: string) => {
      seen.push(url);
      return new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n0018A45C4D1DEF81644B54AB7F969B88D65:1");
    }) as unknown as typeof fetch;
    expect(await isBreached("password", fake)).toBe(true);
    expect(seen[0]).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await isBreached("password", down)).toBe(false);
    const clean = (async () => new Response("0018A45C4D1DEF81644B54AB7F969B88D65:1")) as unknown as typeof fetch;
    expect(await checkPassword("plantain at midnight, twice", undefined, clean)).toBeNull();
  });
});

describe("audit hash chain", () => {
  const build = (bodies: unknown[]): ChainRow[] => {
    let prev = GENESIS;
    return bodies.map((body, i) => {
      const hash = chainHash(prev, body);
      const row = { id: `e${i}`, prevHash: prev, hash, body };
      prev = hash;
      return row;
    });
  };
  const bodies = [
    { action: "staff.login", actor: "s1", at: "2026-10-11T10:00:00Z" },
    { action: "orders.update_status", actor: "s2", target: "o1", diff: { status: ["RECEIVED", "CONFIRMED"] } },
    { action: "catalogue.price", actor: "s1", target: "p9", diff: { memberPrice: [1000, 1100] } },
  ];

  it("verifies an intact chain", () => expect(verifyChain(build(bodies))).toBeNull());

  it("catches an edited row", () => {
    const rows = build(bodies);
    rows[1] = { ...rows[1], body: { ...(rows[1].body as object), actor: "someone-else" } };
    expect(verifyChain(rows)).toEqual({ brokenAt: "e1", reason: "hash" });
  });

  it("catches a deleted or reordered row", () => {
    const rows = build(bodies);
    expect(verifyChain([rows[0], rows[2]])).toEqual({ brokenAt: "e2", reason: "prev" });
    expect(verifyChain([rows[1], rows[0], rows[2]])).toEqual({ brokenAt: "e1", reason: "prev" });
  });

  it("hashes key order independently", () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("redacts secrets at any depth", () => {
    expect(redact({ email: "x@y.z", passwordHash: "v2$…", nested: { totpSecret: "abc", ok: 1 } })).toEqual({
      email: "x@y.z",
      passwordHash: "[redacted]",
      nested: { totpSecret: "[redacted]", ok: 1 },
    });
  });
});
