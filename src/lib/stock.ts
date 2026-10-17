import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, StockMovementKind } from "@/generated/prisma/client";
import { orderToStock, planFefo } from "@/lib/stock-core";

/*
 * The stock ledger. Product.stockOnHand only ever changes here, together
 * with a StockMovement row in the same transaction, so the count and its
 * history can't disagree. Batches (with best-before dates) are drawn down
 * first-expiring-first; that's for freshness and waste reporting, while
 * stockOnHand stays the number that counts.
 *
 * Stock leaves when an order is packed and comes back if a packed order is
 * cancelled or unpacked; Order.stockTakenAt makes each happen exactly once.
 */

export type Tx = Prisma.TransactionClient;
export type Actor = { id: string | null; name: string };

type MoveInput = {
  productId: string;
  kind: StockMovementKind;
  /** Signed change, in the product's quantity unit. */
  quantity: number;
  reason?: string | null;
  orderId?: string | null;
  batchId?: string | null;
  supplierId?: string | null;
  unitCost?: number | null;
};

/** Applies one signed change and records it. Returns the new balance. */
export async function move(tx: Tx, m: MoveInput, actor: Actor): Promise<number> {
  const { stockOnHand } = await tx.product.update({
    where: { id: m.productId },
    // Stock has its own atomic increments; it doesn't touch the edit version,
    // so packing an order never collides with someone editing the product.
    data: { stockOnHand: { increment: m.quantity } },
    select: { stockOnHand: true },
  });
  await tx.stockMovement.create({
    data: {
      productId: m.productId,
      kind: m.kind,
      quantity: m.quantity,
      balanceAfter: stockOnHand,
      reason: m.reason ?? null,
      orderId: m.orderId ?? null,
      batchId: m.batchId ?? null,
      supplierId: m.supplierId ?? null,
      unitCost: m.unitCost ?? null,
      staffId: actor.id,
      staffName: actor.name,
    },
  });
  return stockOnHand;
}

/** Takes quantity out of the product's batches, soonest best-before first. */
async function drawBatches(tx: Tx, productId: string, quantity: number) {
  const batches = await tx.stockBatch.findMany({ where: { productId, remaining: { gt: 0 } }, select: { id: true, remaining: true, bestBefore: true, receivedAt: true } });
  for (const t of planFefo(batches, quantity).take) {
    await tx.stockBatch.updateMany({ where: { id: t.id, remaining: { gte: t.quantity } }, data: { remaining: { decrement: t.quantity } } });
  }
}

/** Locks the product row for the rest of the transaction (stock counts read, then write). */
async function lockProduct(tx: Tx, productId: string): Promise<{ stockOnHand: number } | null> {
  const rows = await tx.$queryRaw<{ stockOnHand: number }[]>`SELECT "stockOnHand" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
  return rows[0] ?? null;
}

export async function receiveStock(
  tx: Tx,
  input: { productId: string; quantity: number; unitCost?: number | null; supplierId?: string | null; bestBefore?: Date | null; reason?: string | null },
  actor: Actor,
): Promise<number> {
  const batch = await tx.stockBatch.create({
    data: {
      productId: input.productId,
      supplierId: input.supplierId ?? null,
      received: input.quantity,
      remaining: input.quantity,
      unitCost: input.unitCost ?? null,
      bestBefore: input.bestBefore ?? null,
    },
  });
  return move(tx, { productId: input.productId, kind: "RECEIVE", quantity: input.quantity, reason: input.reason, batchId: batch.id, supplierId: input.supplierId, unitCost: input.unitCost }, actor);
}

export async function recordWaste(tx: Tx, input: { productId: string; quantity: number; reason: string }, actor: Actor): Promise<number> {
  await drawBatches(tx, input.productId, input.quantity);
  return move(tx, { productId: input.productId, kind: "WASTE", quantity: -input.quantity, reason: input.reason }, actor);
}

/** Sets stock to a physical count; records the difference. No row if nothing changed. */
export async function recordCount(tx: Tx, input: { productId: string; counted: number; reason?: string | null }, actor: Actor): Promise<{ delta: number; balance: number }> {
  const row = await lockProduct(tx, input.productId);
  if (!row) throw new Error("Product not found");
  const delta = input.counted - row.stockOnHand;
  if (delta === 0) return { delta, balance: row.stockOnHand };
  if (delta < 0) await drawBatches(tx, input.productId, -delta);
  const balance = await move(tx, { productId: input.productId, kind: "COUNT", quantity: delta, reason: input.reason ?? "Stock count" }, actor);
  return { delta, balance };
}

/** An order's lines in stock units (grams for weighed produce). */
async function orderLines(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true, product: { select: { soldAs: true, referenceWeightG: true } } } });
  return items.map((i) => ({ productId: i.productId, stock: orderToStock(i.quantity, i.product) }));
}

/** Takes an order's items out of stock, once (at packing). */
export async function takeStockForOrder(tx: Tx, orderId: string, actor: Actor): Promise<void> {
  const { count } = await tx.order.updateMany({ where: { id: orderId, stockTakenAt: null }, data: { stockTakenAt: new Date() } });
  if (count === 0) return;
  for (const i of await orderLines(tx, orderId)) {
    await drawBatches(tx, i.productId, i.stock);
    await move(tx, { productId: i.productId, kind: "SALE", quantity: -i.stock, orderId, reason: "Packed for order" }, actor);
  }
}

/** Puts a packed order's items back, once (cancelled or unpacked after packing). */
export async function returnStockForOrder(tx: Tx, orderId: string, actor: Actor, reason: string): Promise<void> {
  const { count } = await tx.order.updateMany({ where: { id: orderId, stockTakenAt: { not: null } }, data: { stockTakenAt: null } });
  if (count === 0) return;
  for (const i of await orderLines(tx, orderId)) await move(tx, { productId: i.productId, kind: "RETURN", quantity: i.stock, orderId, reason }, actor);
}

/** Statuses whose items are promised but not yet taken from stock. */
export const COMMITTED_STATUSES = ["RECEIVED", "CONFIRMED", "PICKING"] as const;

/** Per product: stock promised to open orders that haven't been packed yet (in stock units). */
export async function committedByProduct(productIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      ...(productIds && { productId: { in: productIds } }),
      order: { status: { in: [...COMMITTED_STATUSES] }, stockTakenAt: null },
    },
    _sum: { quantity: true },
  });
  const products = await prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: { id: true, soldAs: true, referenceWeightG: true } });
  const meta = new Map(products.map((p) => [p.id, p]));
  return new Map(rows.map((r) => [r.productId, orderToStock(r._sum.quantity ?? 0, meta.get(r.productId) ?? { soldAs: "SINGLE", referenceWeightG: null })]));
}
