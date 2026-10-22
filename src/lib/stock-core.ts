/*
 * Pure stock rules, shared by the stock ledger (src/lib/stock.ts) and tests.
 */

export type BatchLike = { id: string; remaining: number; bestBefore: Date | null; receivedAt: Date };

/**
 * Which batches to draw `quantity` from: soonest best-before first, then
 * oldest received (batches without a date go after dated ones). Draws only
 * what's there; any shortfall is returned, not invented.
 */
export function planFefo(batches: BatchLike[], quantity: number): { take: { id: string; quantity: number }[]; shortfall: number } {
  const order = [...batches]
    .filter((b) => b.remaining > 0)
    .sort((a, b) => {
      const ab = a.bestBefore?.getTime() ?? Number.POSITIVE_INFINITY;
      const bb = b.bestBefore?.getTime() ?? Number.POSITIVE_INFINITY;
      return ab - bb || a.receivedAt.getTime() - b.receivedAt.getTime();
    });
  const take: { id: string; quantity: number }[] = [];
  let left = Math.max(0, Math.trunc(quantity));
  for (const b of order) {
    if (left === 0) break;
    const q = Math.min(left, b.remaining);
    take.push({ id: b.id, quantity: q });
    left -= q;
  }
  return { take, shortfall: left };
}

/**
 * Orders count what's sold: pieces, sets, or packs of a weighed product's
 * reference weight ("per 250g": 2 means 500g). Stock counts grams for
 * weighed produce. This is the one conversion between the two.
 */
export function orderToStock(quantity: number, p: { soldAs: string; referenceWeightG: number | null }): number {
  return p.soldAs === "WEIGHT" ? quantity * (p.referenceWeightG ?? 1) : quantity;
}

/** An order line's quantity as people read it: "500 g", "1.5 kg", "3". */
export function formatOrderQty(quantity: number, p: { soldAs: string; referenceWeightG: number | null }): string {
  return formatQty(orderToStock(quantity, p), p.soldAs);
}

/** What's free to promise: on hand less what open, unpacked orders already need. */
export function availableToSell(onHand: number, committed: number): number {
  return onHand - committed;
}

/** Low when tracked and at or under the reorder point. */
export function isLowStock(onHand: number, reorderPoint: number | null): boolean {
  return reorderPoint !== null && onHand <= reorderPoint;
}

/** Shown quantities: grams become kg for weighed produce. */
export function formatQty(quantity: number, soldAs: string): string {
  if (soldAs !== "WEIGHT") return quantity.toLocaleString("en-NG");
  if (Math.abs(quantity) < 1000) return `${quantity.toLocaleString("en-NG")} g`;
  return `${(quantity / 1000).toLocaleString("en-NG", { maximumFractionDigits: 2 })} kg`;
}

/** The unit stock is counted in, for column headers and forms. */
export function stockUnit(soldAs: string): string {
  return soldAs === "WEIGHT" ? "g" : soldAs === "SET" ? "sets" : "pcs";
}
