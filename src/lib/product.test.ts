import { describe, expect, it } from "vitest";
import { isOffered, MAX_LINE_QUANTITY, snapQuantity } from "./product";

const pieces = { minOrderQty: 2, stepQty: 2, soldAs: "SET" };
// Weighed produce is sold in packs of its reference weight (e.g. "per 250g"): quantity counts packs.
const leaf = { minOrderQty: 1, stepQty: 1, soldAs: "WEIGHT" };
const crate = { minOrderQty: 10, stepQty: 5, soldAs: "SINGLE" };

describe("snapQuantity", () => {
  it("rounds up to the pack size", () => {
    expect(snapQuantity(1, pieces)).toBe(2);
    expect(snapQuantity(3, pieces)).toBe(4);
    expect(snapQuantity(12, crate)).toBe(15);
    expect(snapQuantity(3, leaf)).toBe(3);
  });

  it("treats nothing, negatives and junk as zero", () => {
    expect(snapQuantity(0, pieces)).toBe(0);
    expect(snapQuantity(-5, pieces)).toBe(0);
    expect(snapQuantity(Number.NaN, pieces)).toBe(0);
    expect(snapQuantity(Number.POSITIVE_INFINITY, pieces)).toBe(0);
  });

  it("caps absurd values on a pack boundary", () => {
    expect(snapQuantity(1_000_000, pieces)).toBe(200);
    // 200 packs of a 250g leaf is 50kg: the cap is in packs, never grams.
    expect(snapQuantity(10_000_000, leaf)).toBe(200);
    expect(snapQuantity(10_000_000, crate)).toBe(200);
    const odd = { minOrderQty: 3, stepQty: 7, soldAs: "SINGLE" };
    const capped = snapQuantity(999_999, odd);
    expect(capped).toBeLessThanOrEqual(MAX_LINE_QUANTITY);
    expect((capped - odd.minOrderQty) % odd.stepQty).toBe(0);
  });

  it("knows which products we still sell", () => {
    expect(isOffered({ tags: [] })).toBe(true);
    expect(isOffered({ tags: ["fresh-cuts"] })).toBe(false);
  });
});

describe("availability", () => {
  it("hides HIDDEN products and blocks buying OUT_OF_STOCK ones", async () => {
    const { isOffered, isBuyable, inSeasonFor } = await import("./product");
    expect(isOffered({ tags: [], availability: "HIDDEN" })).toBe(false);
    expect(isOffered({ tags: [], availability: "OUT_OF_STOCK" })).toBe(true);
    expect(isBuyable({ tags: [], availability: "OUT_OF_STOCK" })).toBe(false);
    expect(isBuyable({ tags: [], availability: "LIMITED" })).toBe(true);
    expect(isBuyable({ tags: ["fresh-cuts"], availability: "AVAILABLE" })).toBe(false);
    expect(inSeasonFor("AVAILABLE")).toBe(true);
    expect(inSeasonFor("LIMITED")).toBe(false);
  });
});
