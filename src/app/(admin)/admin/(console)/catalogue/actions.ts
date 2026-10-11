"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { inSeasonFor } from "@/lib/product";
import type { StaffContext } from "@/lib/admin/session";

/*
 * The product catalogue. Copy and setup need catalogue.edit; prices need
 * catalogue.price (with step-up) and keep a history; availability needs
 * catalogue.availability, and hiding or un-hiding a product from the site
 * needs catalogue.publish. Every save names the version it started from.
 */

const CONFLICT = { ok: false as const, code: "CONFLICT" as const, error: "Someone else changed this product while you were editing. Reload to see their changes." };
const AVAILABILITY = ["AVAILABLE", "LIMITED", "OUT_OF_STOCK", "HIDDEN"] as const;
const text = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();

const detailsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(80),
  category: z.enum(["FRUIT", "VEGETABLE", "BOX_BUNDLE", "SEASONAL"]),
  unit: z.string().trim().min(2).max(40),
  orderUnit: z.enum(["PIECE", "PAIR", "WEIGHT"]),
  soldAs: z.enum(["SINGLE", "SET", "WEIGHT"]),
  setSize: z.number().int().min(2).max(100).nullable(),
  referenceWeightG: z.number().int().min(1).max(50_000).nullable(),
  minOrderQty: z.number().int().min(1).max(50_000),
  stepQty: z.number().int().min(1).max(50_000),
  color: z.enum(["RED", "ORANGE", "YELLOW", "GREEN", "PURPLE", "WHITE_BROWN"]).nullable(),
  imageEmoji: z.string().trim().min(1).max(8),
  source: z.string().trim().min(1).max(80),
  featured: z.boolean(),
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(30)).max(20),
  relatedProductIds: z.array(z.string().max(40)).max(12),
  description: text(300),
  blurb: text(1200),
  sourcingLine: text(200),
  educationCopy: text(2000),
  benefitsCopy: text(2000),
  howToEnjoyCopy: text(2000),
  storageTips: text(2000),
});
export type ProductDetails = z.input<typeof detailsSchema>;

function done(id?: string) {
  revalidatePath("/catalogue");
  if (id) revalidatePath(`/catalogue/${id}`);
  // The shop reads these too.
  revalidatePath("/shop", "layout");
}

function checkShape(d: z.output<typeof detailsSchema>): string | null {
  if (d.soldAs === "SET" && !d.setSize) return "A product sold in sets needs a set size.";
  if (d.soldAs === "WEIGHT" && !d.referenceWeightG) return "A weighed product needs the weight its price is for (in grams).";
  if (d.soldAs === "WEIGHT" && d.orderUnit !== "WEIGHT") return "A weighed product is ordered by weight.";
  return null;
}

async function slugTaken(slug: string, exceptId?: string) {
  const p = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(p && p.id !== exceptId);
}

export async function createProduct(input: { details: ProductDetails; standardPrice: number; memberPrice: number }): Promise<ActionResult<{ id: string }>> {
  return staffAction("catalogue.edit", async (ctx) => {
    const d = detailsSchema.safeParse(input.details);
    if (!d.success) return { ok: false, code: "INVALID", error: d.error.issues[0]?.message ?? "Check the details." };
    const shape = checkShape(d.data);
    if (shape) return { ok: false, code: "INVALID", error: shape };
    const prices = z.object({ standardPrice: z.number().int().min(1).max(10_000_000), memberPrice: z.number().int().min(1).max(10_000_000) }).safeParse(input);
    if (!prices.success || prices.data.memberPrice > prices.data.standardPrice) return { ok: false, code: "INVALID", error: "Prices must be whole naira, and the member price no higher than the standard one." };
    if (await slugTaken(d.data.slug)) return { ok: false, code: "CONFLICT", error: "Another product already uses that web address." };

    // New products start hidden, so they can be finished before anyone sees them.
    const p = await prisma.product.create({
      data: { ...d.data, ...prices.data, availability: "HIDDEN", inSeason: false },
    });
    await prisma.priceChange.createMany({
      data: [
        { productId: p.id, field: "standardPrice", fromValue: null, toValue: p.standardPrice, reason: "New product", staffId: ctx.staff.id, staffName: ctx.staff.name },
        { productId: p.id, field: "memberPrice", fromValue: null, toValue: p.memberPrice, reason: "New product", staffId: ctx.staff.id, staffName: ctx.staff.name },
      ],
    });
    await auditStaff(ctx, { action: "catalogue.product_created", targetType: "Product", targetId: p.id, summary: `Created ${p.name} (hidden until published)` });
    done();
    return { ok: true, data: { id: p.id } };
  });
}

export async function saveProductDetails(input: { id: string; version: number; details: ProductDetails }): Promise<ActionResult> {
  return staffAction("catalogue.edit", async (ctx) => {
    const d = detailsSchema.safeParse(input.details);
    if (!d.success) return { ok: false, code: "INVALID", error: d.error.issues[0]?.message ?? "Check the details." };
    const shape = checkShape(d.data);
    if (shape) return { ok: false, code: "INVALID", error: shape };
    const before = await prisma.product.findUnique({ where: { id: String(input.id).slice(0, 40) } });
    if (!before) return { ok: false, code: "INVALID", error: "That product doesn't exist." };
    if (await slugTaken(d.data.slug, before.id)) return { ok: false, code: "CONFLICT", error: "Another product already uses that web address." };
    const related = d.data.relatedProductIds.filter((r) => r !== before.id);

    const { count } = await prisma.product.updateMany({
      where: { id: before.id, version: input.version },
      data: { ...d.data, relatedProductIds: related, version: { increment: 1 } },
    });
    if (!count) return CONFLICT;
    const changed = Object.keys(d.data).filter((k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((d.data as Record<string, unknown>)[k] ?? null));
    await auditStaff(ctx, { action: "catalogue.product_edited", targetType: "Product", targetId: before.id, summary: `${before.name}: ${changed.join(", ") || "no changes"}` });
    done(before.id);
    return { ok: true, data: undefined };
  });
}

async function setAvailabilityFor(ctx: StaffContext, productId: string, availability: (typeof AVAILABILITY)[number]): Promise<ActionResult> {
  const role = ctx.staff.role as Role;
  const before = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, availability: true, version: true } });
  if (!before) return { ok: false, code: "INVALID", error: "That product doesn't exist." };
  if (before.availability === availability) return { ok: true, data: undefined };
  // Putting a product on or taking it off the site is publishing.
  if ((before.availability === "HIDDEN" || availability === "HIDDEN") && !can(role, "catalogue.publish")) {
    return { ok: false, code: "FORBIDDEN", error: "Your role can't hide products or put hidden ones on the site." };
  }
  // A single independent field: it doesn't need (or bump) the edit version.
  await prisma.product.update({ where: { id: productId }, data: { availability, inSeason: inSeasonFor(availability) } });
  await auditStaff(ctx, { action: "catalogue.availability_changed", targetType: "Product", targetId: productId, summary: `${before.name}: ${before.availability} → ${availability}`, diff: { availability: [before.availability, availability] } });
  return { ok: true, data: undefined };
}

export async function setAvailability(input: { id: string; availability: string }): Promise<ActionResult> {
  return staffAction("catalogue.availability", async (ctx) => {
    const a = z.enum(AVAILABILITY).safeParse(input.availability);
    if (!a.success) return { ok: false, code: "INVALID", error: "Pick an availability." };
    const r = await setAvailabilityFor(ctx, String(input.id).slice(0, 40), a.data);
    if (r.ok) done(input.id);
    return r;
  });
}

export async function setPrices(input: { id: string; version: number; standardPrice: number; memberPrice: number; costPrice: number | null; reason: string }): Promise<ActionResult> {
  return staffAction("catalogue.price", async (ctx) => {
    const parsed = z
      .object({
        id: z.string().max(40),
        version: z.number().int().min(0),
        standardPrice: z.number().int().min(1).max(10_000_000),
        memberPrice: z.number().int().min(1).max(10_000_000),
        costPrice: z.number().int().min(0).max(10_000_000).nullable(),
        reason: z.string().trim().min(3).max(200),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Prices are whole naira, and say why they're changing." };
    const p = parsed.data;
    if (p.memberPrice > p.standardPrice) return { ok: false, code: "INVALID", error: "The member price can't be higher than the standard price." };
    const before = await prisma.product.findUnique({ where: { id: p.id } });
    if (!before) return { ok: false, code: "INVALID", error: "That product doesn't exist." };

    const changes = (["standardPrice", "memberPrice", "costPrice"] as const).filter((f) => before[f] !== p[f]);
    if (!changes.length) return { ok: true, data: undefined };
    // A swing of more than half either way is almost always a typo (an extra zero).
    for (const f of changes) {
      const from = before[f];
      const to = p[f];
      if (from && to && (to > from * 1.5 || to < from * 0.5) && !p.reason.toLowerCase().includes("confirm")) {
        return { ok: false, code: "INVALID", error: `${f === "standardPrice" ? "Standard" : f === "memberPrice" ? "Member" : "Cost"} price moves from ₦${from.toLocaleString("en-NG")} to ₦${to.toLocaleString("en-NG")}. If that's right, add "confirm" to the reason.` };
      }
    }
    const ok = await prisma.$transaction(async (tx) => {
      const { count } = await tx.product.updateMany({
        where: { id: p.id, version: p.version },
        data: { standardPrice: p.standardPrice, memberPrice: p.memberPrice, costPrice: p.costPrice, version: { increment: 1 } },
      });
      if (!count) return false;
      await tx.priceChange.createMany({
        data: changes.map((f) => ({ productId: p.id, field: f, fromValue: before[f], toValue: p[f], reason: p.reason, staffId: ctx.staff.id, staffName: ctx.staff.name })),
      });
      return true;
    });
    if (!ok) return CONFLICT;
    await auditStaff(ctx, {
      action: "catalogue.prices_changed",
      targetType: "Product",
      targetId: p.id,
      summary: `${before.name}: ${changes.map((f) => `${f} ${before[f] ?? "—"} → ${p[f] ?? "—"}`).join(", ")}`,
      diff: Object.fromEntries(changes.map((f) => [f, [before[f], p[f]]])),
    });
    done(p.id);
    return { ok: true, data: undefined };
  });
}

/**
 * Signs one direct upload to Cloudinary for a product photo: fixed folder,
 * image formats only, a fresh public id. The browser sends the file straight
 * to Cloudinary; our API secret never leaves the server.
 */
export async function signProductUpload(productId: string): Promise<ActionResult<{ url: string; fields: Record<string, string> }>> {
  return staffAction("catalogue.edit", async () => {
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || "dusynu0kv";
    if (!key || !secret) return { ok: false, code: "ERROR", error: "Photo uploads aren't set up on this server (Cloudinary keys missing)." };
    const product = await prisma.product.findUnique({ where: { id: String(productId).slice(0, 40) }, select: { slug: true } });
    if (!product) return { ok: false, code: "INVALID", error: "That product doesn't exist." };
    const folder = `${process.env.CLOUDINARY_FOLDER || "Fruits_Veggie"}`;
    const params: Record<string, string> = {
      allowed_formats: "jpg,jpeg,png,webp",
      asset_folder: folder,
      public_id: `${folder}/${product.slug}-${randomBytes(4).toString("hex")}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
    const signature = createHash("sha1").update(toSign + secret).digest("hex");
    return { ok: true, data: { url: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`, fields: { ...params, api_key: key, signature } } };
  });
}

/** Saves the uploaded photo's id; only ids from our own folder are accepted. */
export async function setProductImage(input: { id: string; publicId: string | null }): Promise<ActionResult> {
  return staffAction("catalogue.edit", async (ctx) => {
    const folder = process.env.CLOUDINARY_FOLDER || "Fruits_Veggie";
    const publicId = input.publicId === null ? null : String(input.publicId).slice(0, 200);
    if (publicId !== null && !new RegExp(`^${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[a-z0-9-]+$`).test(publicId)) {
      return { ok: false, code: "INVALID", error: "That isn't one of our product photos." };
    }
    const before = await prisma.product.findUnique({ where: { id: String(input.id).slice(0, 40) }, select: { id: true, name: true, cloudinaryPublicId: true } });
    if (!before) return { ok: false, code: "INVALID", error: "That product doesn't exist." };
    await prisma.product.update({ where: { id: before.id }, data: { cloudinaryPublicId: publicId } });
    await auditStaff(ctx, { action: "catalogue.photo_changed", targetType: "Product", targetId: before.id, summary: `${before.name}: ${publicId ? "new photo" : "photo removed"}`, diff: { photo: [before.cloudinaryPublicId, publicId] } });
    done(before.id);
    return { ok: true, data: undefined };
  });
}
