import { describe, expect, it } from "vitest";
import { isOffered, maxQuantityFor, snapQuantity } from "./product";

const pieces = { minOrderQty: 2, stepQty: 2, soldAs: "SET" };
const grams = { minOrderQty: 500, stepQty: 250, soldAs: "WEIGHT" };

describe("snapQuantity", () => {
  it("rounds up to the pack size", () => {
    expect(snapQuantity(1, pieces)).toBe(2);
    expect(snapQuantity(3, pieces)).toBe(4);
    expect(snapQuantity(600, grams)).toBe(750);
  });

  it("treats nothing, negatives and junk as zero", () => {
    expect(snapQuantity(0, pieces)).toBe(0);
    expect(snapQuantity(-5, pieces)).toBe(0);
    expect(snapQuantity(Number.NaN, pieces)).toBe(0);
    expect(snapQuantity(Number.POSITIVE_INFINITY, pieces)).toBe(0);
  });

  it("caps absurd values on a pack boundary", () => {
    expect(snapQuantity(1_000_000, pieces)).toBe(200);
    expect(snapQuantity(10_000_000, grams)).toBe(50_000);
    const odd = { minOrderQty: 3, stepQty: 7, soldAs: "SINGLE" };
    const capped = snapQuantity(999_999, odd);
    expect(capped).toBeLessThanOrEqual(maxQuantityFor(odd));
    expect((capped - odd.minOrderQty) % odd.stepQty).toBe(0);
  });

  it("knows which products we still sell", () => {
    expect(isOffered({ tags: [] })).toBe(true);
    expect(isOffered({ tags: ["fresh-cuts"] })).toBe(false);
  });
});
