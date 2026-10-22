import { describe, expect, it } from "vitest";
import { formatOrderQty, formatQty, isLowStock, orderToStock, planFefo } from "./stock-core";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("first-expiring-first-out", () => {
  const batches = [
    { id: "late", remaining: 10, bestBefore: d("2026-10-20"), receivedAt: d("2026-10-01") },
    { id: "soon", remaining: 4, bestBefore: d("2026-10-14"), receivedAt: d("2026-10-05") },
    { id: "undated", remaining: 5, bestBefore: null, receivedAt: d("2026-09-01") },
    { id: "empty", remaining: 0, bestBefore: d("2026-10-12"), receivedAt: d("2026-10-01") },
  ];

  it("draws the soonest best-before first and skips empty batches", () => {
    expect(planFefo(batches, 6)).toEqual({ take: [{ id: "soon", quantity: 4 }, { id: "late", quantity: 2 }], shortfall: 0 });
  });

  it("uses undated batches last", () => {
    expect(planFefo(batches, 16).take.map((t) => t.id)).toEqual(["soon", "late", "undated"]);
  });

  it("reports a shortfall instead of inventing stock", () => {
    expect(planFefo(batches, 25)).toEqual({ take: [{ id: "soon", quantity: 4 }, { id: "late", quantity: 10 }, { id: "undated", quantity: 5 }], shortfall: 6 });
    expect(planFefo([], 3).shortfall).toBe(3);
  });

  it("ignores nonsense quantities", () => {
    expect(planFefo(batches, -5)).toEqual({ take: [], shortfall: 0 });
  });
});

describe("stock display", () => {
  it("shows grams as kilograms for weighed produce", () => {
    expect(formatQty(1500, "WEIGHT")).toBe("1.5 kg");
    expect(formatQty(500, "WEIGHT")).toBe("500 g");
    expect(formatQty(12, "SINGLE")).toBe("12");
  });
  it("flags low stock only when a reorder point is set", () => {
    expect(isLowStock(3, 5)).toBe(true);
    expect(isLowStock(3, null)).toBe(false);
  });
});

describe("order to stock", () => {
  const leaf = { soldAs: "WEIGHT", referenceWeightG: 250 };
  it("turns weighed packs into grams and leaves counted items alone", () => {
    expect(orderToStock(2, leaf)).toBe(500);
    expect(orderToStock(3, { soldAs: "SET", referenceWeightG: null })).toBe(3);
    expect(formatOrderQty(6, leaf)).toBe("1.5 kg");
    expect(formatOrderQty(1, leaf)).toBe("250 g");
  });
});
