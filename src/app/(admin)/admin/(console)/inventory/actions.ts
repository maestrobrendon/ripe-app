"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, needsStepUp, type ActionResult } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { receiveStock, recordCount, recordWaste } from "@/lib/stock";
import { parseYmd } from "@/lib/delivery-dates";

/*
 * Inventory actions. Quantities arrive in the product's own stock unit
 * (grams for weighed produce); the screens convert from kg before sending.
 * Every stock change goes through the ledger in src/lib/stock.ts.
 */

const MAX_ROWS = 500;
const qty = z.number().int().min(-10_000_000).max(10_000_000);

function done() {
  revalidatePath("/inventory", "layout");
  revalidatePath("/catalogue");
}

/* ------------------------------- stock grid ------------------------------- */

const gridRow = z.object({
  productId: z.string().max(40),
  version: z.number().int().min(0),
  onHand: qty.optional(),
  reorderPoint: z.number().int().min(0).max(10_000_000).nullable().optional(),
  costPrice: z.number().int().min(0).max(10_000_000).nullable().optional(),
  standardPrice: z.number().int().min(1).max(10_000_000).optional(),
  memberPrice: z.number().int().min(1).max(10_000_000).optional(),
});

export type GridChange = z.input<typeof gridRow>;

/**
 * Saves a reviewed set of grid edits. Stock counts and reorder points need
 * inventory.adjust; any price needs catalogue.price and a fresh second factor.
 * Rows someone else changed since the grid loaded are skipped and reported,
 * never overwritten.
 */
export async function saveStockGrid(input: { changes: GridChange[]; reason: string }): Promise<ActionResult<{ saved: number; skipped: string[] }>> {
  return staffAction("inventory.adjust", async (ctx) => {
    const parsed = z.object({ changes: z.array(gridRow).min(1).max(MAX_ROWS), reason: z.string().trim().min(3).max(200) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Say what these changes are (e.g. Monday stock count), and keep each value a whole number." };
    const { changes, reason } = parsed.data;
    const role = ctx.staff.role as Role;
    const touchesPrice = changes.some((c) => c.costPrice !== undefined || c.standardPrice !== undefined || c.memberPrice !== undefined);
    if (touchesPrice && !can(role, "catalogue.price")) return { ok: false, code: "FORBIDDEN", error: "Your role can't change prices. Remove the price edits and save again." };
    if (touchesPrice && needsStepUp(ctx, "catalogue.price")) return { ok: false, code: "STEP_UP", error: "Confirm it's you to change prices." };

    const actor = { id: ctx.staff.id, name: ctx.staff.name };
    const products = await prisma.product.findMany({ where: { id: { in: changes.map((c) => c.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const skipped: string[] = [];
    let saved = 0;
    const summary: string[] = [];

    for (const c of changes) {
      const p = byId.get(c.productId);
      if (!p) continue;
      const std = c.standardPrice ?? p.standardPrice;
      const mem = c.memberPrice ?? p.memberPrice;
      if (mem > std) {
        skipped.push(`${p.name} (member price above standard)`);
        continue;
      }
      const ok = await prisma.$transaction(async (tx) => {
        // Claim the row at the version the grid showed; a newer edit wins and this row is skipped.
        const { count } = await tx.product.updateMany({
          where: { id: p.id, version: c.version },
          data: {
            version: { increment: 1 },
            ...(c.reorderPoint !== undefined && { reorderPoint: c.reorderPoint }),
            ...(c.costPrice !== undefined && { costPrice: c.costPrice }),
            ...(c.standardPrice !== undefined && { standardPrice: c.standardPrice }),
            ...(c.memberPrice !== undefined && { memberPrice: c.memberPrice }),
          },
        });
        if (!count) return false;
        const prices = (["standardPrice", "memberPrice", "costPrice"] as const).filter((f) => c[f] !== undefined && c[f] !== p[f]);
        if (prices.length) {
          await tx.priceChange.createMany({
            data: prices.map((f) => ({ productId: p.id, field: f, fromValue: p[f], toValue: c[f] ?? null, reason, staffId: actor.id, staffName: actor.name })),
          });
        }
        if (c.onHand !== undefined) await recordCount(tx, { productId: p.id, counted: c.onHand, reason }, actor);
        return true;
      });
      if (!ok) {
        skipped.push(`${p.name} (changed by someone else)`);
        continue;
      }
      saved++;
      summary.push(
        [
          p.name,
          c.onHand !== undefined && `count ${p.stockOnHand}→${c.onHand}`,
          c.reorderPoint !== undefined && `reorder ${p.reorderPoint ?? "—"}→${c.reorderPoint ?? "—"}`,
          c.standardPrice !== undefined && `standard ${p.standardPrice}→${c.standardPrice}`,
          c.memberPrice !== undefined && `member ${p.memberPrice}→${c.memberPrice}`,
          c.costPrice !== undefined && `cost ${p.costPrice ?? "—"}→${c.costPrice ?? "—"}`,
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    await auditStaff(ctx, {
      action: touchesPrice ? "inventory.grid_saved_with_prices" : "inventory.grid_saved",
      targetType: "Product",
      summary: `${saved} product(s) updated from the stock grid: ${reason}`.slice(0, 480),
      diff: { rows: summary.slice(0, 200), skipped },
    });
    done();
    return { ok: true, data: { saved, skipped } };
  });
}

/* -------------------------------- receiving ------------------------------- */

const receiveLine = z.object({
  productId: z.string().max(40),
  quantity: z.number().int().min(1).max(10_000_000),
  unitCost: z.number().int().min(0).max(10_000_000).nullable(),
  bestBefore: z.string().max(10).nullable(),
});

export async function receiveDelivery(input: { supplierId: string | null; note: string; lines: z.input<typeof receiveLine>[] }): Promise<ActionResult<{ lines: number }>> {
  return staffAction("inventory.receive", async (ctx) => {
    const parsed = z.object({ supplierId: z.string().max(40).nullable(), note: z.string().trim().max(200), lines: z.array(receiveLine).min(1).max(100) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Each line needs a product and a quantity above zero." };
    const { supplierId, note, lines } = parsed.data;
    if (supplierId && !(await prisma.supplier.count({ where: { id: supplierId } }))) return { ok: false, code: "INVALID", error: "That supplier doesn't exist." };
    const actor = { id: ctx.staff.id, name: ctx.staff.name };
    await prisma.$transaction(async (tx) => {
      for (const l of lines) {
        const bestBefore = parseYmd(l.bestBefore);
        await receiveStock(tx, { productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, supplierId, bestBefore, reason: note || "Delivery received" }, actor);
      }
    });
    await auditStaff(ctx, { action: "inventory.received", summary: `Received ${lines.length} line(s)${note ? `: ${note}` : ""}`, diff: { supplierId, lines } });
    done();
    return { ok: true, data: { lines: lines.length } };
  });
}

/* ---------------------------------- waste --------------------------------- */

export async function recordWasteLines(input: { lines: { productId: string; quantity: number; reason: string }[] }): Promise<ActionResult<{ lines: number }>> {
  return staffAction("inventory.adjust", async (ctx) => {
    const parsed = z
      .object({ lines: z.array(z.object({ productId: z.string().max(40), quantity: z.number().int().min(1).max(10_000_000), reason: z.string().trim().min(2).max(200) })).min(1).max(100) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Each line needs a product, a quantity and a reason (e.g. bruised, past best-before)." };
    const actor = { id: ctx.staff.id, name: ctx.staff.name };
    await prisma.$transaction(async (tx) => {
      for (const l of parsed.data.lines) await recordWaste(tx, l, actor);
    });
    await auditStaff(ctx, { action: "inventory.waste_recorded", summary: `Recorded waste on ${parsed.data.lines.length} line(s)`, diff: { lines: parsed.data.lines } });
    done();
    return { ok: true, data: { lines: parsed.data.lines.length } };
  });
}

/* ------------------------------- CSV import ------------------------------- */

/**
 * Applies a stock count from a spreadsheet: rows of product web address and
 * counted quantity. Shown as a preview first; applying needs a fresh second
 * factor (it can rewrite every count at once).
 */
export async function importCounts(input: { rows: { slug: string; counted: number }[]; reason: string }): Promise<ActionResult<{ applied: number }>> {
  return staffAction("inventory.import", async (ctx) => {
    const parsed = z
      .object({ rows: z.array(z.object({ slug: z.string().trim().toLowerCase().max(80), counted: z.number().int().min(0).max(10_000_000) })).min(1).max(MAX_ROWS), reason: z.string().trim().min(3).max(200) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Every row needs a product and a whole-number count of zero or more." };
    const products = await prisma.product.findMany({ where: { slug: { in: parsed.data.rows.map((r) => r.slug) } }, select: { id: true, slug: true } });
    const bySlug = new Map(products.map((p) => [p.slug, p.id]));
    const unknown = parsed.data.rows.filter((r) => !bySlug.has(r.slug)).map((r) => r.slug);
    if (unknown.length) return { ok: false, code: "INVALID", error: `These aren't products: ${unknown.slice(0, 8).join(", ")}${unknown.length > 8 ? "…" : ""}` };
    const actor = { id: ctx.staff.id, name: ctx.staff.name };
    let applied = 0;
    await prisma.$transaction(async (tx) => {
      for (const r of parsed.data.rows) {
        const { delta } = await recordCount(tx, { productId: bySlug.get(r.slug)!, counted: r.counted, reason: `Import: ${parsed.data.reason}` }, actor);
        if (delta !== 0) applied++;
      }
    }, { timeout: 30_000 });
    await auditStaff(ctx, { action: "inventory.counts_imported", summary: `Imported ${parsed.data.rows.length} count(s), ${applied} changed: ${parsed.data.reason}` });
    done();
    return { ok: true, data: { applied } };
  });
}

/* -------------------------------- suppliers ------------------------------- */

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(32).transform((v) => v || null),
  market: z.string().trim().max(80).transform((v) => v || null),
  notes: z.string().trim().max(500).transform((v) => v || null),
  active: z.boolean(),
});

export async function saveSupplier(input: { id?: string } & z.input<typeof supplierSchema>): Promise<ActionResult> {
  return staffAction("suppliers.manage", async (ctx) => {
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "A supplier needs a name." };
    const s = input.id
      ? await prisma.supplier.update({ where: { id: String(input.id).slice(0, 40) }, data: parsed.data })
      : await prisma.supplier.create({ data: parsed.data });
    await auditStaff(ctx, { action: input.id ? "suppliers.updated" : "suppliers.created", targetType: "Supplier", targetId: s.id, summary: s.name });
    done();
    return { ok: true, data: undefined };
  });
}

export async function setProductSupplier(input: { productId: string; supplierId: string | null }): Promise<ActionResult> {
  return staffAction("suppliers.manage", async (ctx) => {
    const p = await prisma.product.findUnique({ where: { id: String(input.productId).slice(0, 40) }, select: { id: true, name: true } });
    if (!p) return { ok: false, code: "INVALID", error: "That product doesn't exist." };
    if (input.supplierId && !(await prisma.supplier.count({ where: { id: input.supplierId } }))) return { ok: false, code: "INVALID", error: "That supplier doesn't exist." };
    await prisma.product.update({ where: { id: p.id }, data: { supplierId: input.supplierId } });
    await auditStaff(ctx, { action: "suppliers.product_assigned", targetType: "Product", targetId: p.id, summary: `${p.name}: supplier set` });
    done();
    return { ok: true, data: undefined };
  });
}
