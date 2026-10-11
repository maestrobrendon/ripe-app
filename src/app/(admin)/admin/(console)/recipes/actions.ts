"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { MENU_GOALS } from "@/lib/menu-types";
import { canonical } from "@/lib/admin/audit-chain";
import { cloudinaryUrl, isOurPublicId, signImageUpload, type SignedUpload } from "@/lib/admin/cloudinary";

/*
 * Recipes. Writing them needs recipes.edit; publishing, putting them on the
 * menu and making them members-only needs recipes.publish (those change what
 * customers see and what they get for their plan). Every save names the
 * version it started from.
 */

const CONFLICT = { ok: false as const, code: "CONFLICT" as const, error: "Someone else changed this recipe while you were editing. Reload to see their changes." };
const GOALS = MENU_GOALS.map((g) => g.id) as [string, ...string[]];

const amount = z.tuple([z.number().positive().max(100_000), z.string().trim().max(20)]).nullable();
const recipeSchema = z.object({
  title: z.string().trim().min(3).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(80),
  summary: z.string().trim().min(10).max(200),
  goal: z.enum(GOALS),
  minutes: z.number().int().min(1).max(600),
  serves: z.number().int().min(1).max(20),
  image: z.string().trim().max(300).nullable(),
  imageAlt: z.string().trim().max(200).nullable(),
  basket: z.array(z.object({ slug: z.string().max(80), amount })).max(30),
  elsewhere: z.array(z.object({ label: z.string().trim().min(1).max(60), amount })).max(20),
  steps: z.array(z.string().trim().min(3).max(600)).min(1).max(25),
  tools: z.array(z.string().trim().min(1).max(60)).max(15),
});
export type RecipeInput = z.input<typeof recipeSchema>;

function done(id?: string) {
  revalidatePath("/recipes");
  if (id) revalidatePath(`/recipes/${id}`);
  // The homepage, sign-up and /recipes all read the menu.
  revalidatePath("/", "layout");
}

/** Validates against the catalogue and shapes the row: ids for the older features, amounts by key. */
async function toRow(input: RecipeInput) {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the recipe." } as const;
  const r = parsed.data;
  if (r.image && !(r.image.startsWith("/images/") || r.image.startsWith("https://res.cloudinary.com/"))) return { error: "Use an uploaded photo." } as const;
  const products = await prisma.product.findMany({ where: { slug: { in: r.basket.map((b) => b.slug) } }, select: { id: true, slug: true } });
  const idBySlug = new Map(products.map((p) => [p.slug, p.id]));
  const unknown = r.basket.filter((b) => !idBySlug.has(b.slug)).map((b) => b.slug);
  if (unknown.length) return { error: `Not in the catalogue: ${unknown.join(", ")}` } as const;
  if (new Set(r.basket.map((b) => b.slug)).size !== r.basket.length) return { error: "A product is listed twice." } as const;
  if (r.basket.length + r.elsewhere.length === 0) return { error: "Add at least one ingredient." } as const;

  const amounts: Record<string, [number, string]> = {};
  for (const b of r.basket) if (b.amount) amounts[b.slug] = [b.amount[0], b.amount[1]];
  for (const e of r.elsewhere) if (e.amount) amounts[e.label] = [e.amount[0], e.amount[1]];
  const starter = MENU_GOALS.find((g) => g.id === r.goal)?.starterSlug;
  return {
    row: {
      title: r.title,
      slug: r.slug,
      summary: r.summary,
      goal: r.goal,
      goalTags: starter ? [starter] : [],
      minutes: r.minutes,
      serves: r.serves,
      image: r.image || null,
      imageAlt: r.imageAlt || null,
      basketSlugs: r.basket.map((b) => b.slug),
      ingredientProductIds: r.basket.map((b) => idBySlug.get(b.slug)!),
      elsewhere: r.elsewhere.map((e) => e.label),
      steps: r.steps,
      instructions: r.steps.join("\n"),
      amounts,
      tools: r.tools,
    },
  } as const;
}

export async function createRecipe(input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  return staffAction("recipes.edit", async (ctx) => {
    const shaped = await toRow(input);
    if ("error" in shaped) return { ok: false, code: "INVALID", error: shaped.error! };
    if (await prisma.recipe.count({ where: { slug: shaped.row.slug } })) return { ok: false, code: "CONFLICT", error: "Another recipe already uses that web address." };
    const last = await prisma.recipe.aggregate({ _max: { sortOrder: true } });
    // New recipes start as drafts, off the menu, until someone publishes them.
    const r = await prisma.recipe.create({ data: { ...shaped.row, status: "DRAFT", onMenu: false, sortOrder: (last._max.sortOrder ?? 0) + 10 } });
    await auditStaff(ctx, { action: "recipes.created", targetType: "Recipe", targetId: r.id, summary: `${r.title} (draft)` });
    done();
    return { ok: true, data: { id: r.id } };
  });
}

export async function saveRecipe(input: { id: string; version: number; recipe: RecipeInput }): Promise<ActionResult> {
  return staffAction("recipes.edit", async (ctx) => {
    const before = await prisma.recipe.findUnique({ where: { id: String(input.id).slice(0, 40) } });
    if (!before) return { ok: false, code: "INVALID", error: "That recipe doesn't exist." };
    const shaped = await toRow(input.recipe);
    if ("error" in shaped) return { ok: false, code: "INVALID", error: shaped.error! };
    if (shaped.row.slug !== before.slug && (await prisma.recipe.count({ where: { slug: shaped.row.slug } }))) {
      return { ok: false, code: "CONFLICT", error: "Another recipe already uses that web address." };
    }
    const { count } = await prisma.recipe.updateMany({ where: { id: before.id, version: input.version }, data: { ...shaped.row, version: { increment: 1 } } });
    if (!count) return CONFLICT;
    const changed = (Object.keys(shaped.row) as (keyof typeof shaped.row)[]).filter(
      (k) => canonical((before as Record<string, unknown>)[k] ?? null) !== canonical(shaped.row[k] ?? null),
    );
    await auditStaff(ctx, { action: "recipes.edited", targetType: "Recipe", targetId: before.id, summary: `${shaped.row.title}: ${changed.join(", ") || "no changes"}` });
    done(before.id);
    return { ok: true, data: undefined };
  });
}

/** Status, menu placement and member gating: what customers see. */
export async function setRecipeVisibility(input: { id: string; status?: "DRAFT" | "PUBLISHED"; onMenu?: boolean; membersOnly?: boolean }): Promise<ActionResult> {
  return staffAction("recipes.publish", async (ctx) => {
    const parsed = z
      .object({ id: z.string().max(40), status: z.enum(["DRAFT", "PUBLISHED"]).optional(), onMenu: z.boolean().optional(), membersOnly: z.boolean().optional() })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That change isn't valid." };
    const { id, ...change } = parsed.data;
    const before = await prisma.recipe.findUnique({ where: { id } });
    if (!before) return { ok: false, code: "INVALID", error: "That recipe doesn't exist." };
    const next = { status: change.status ?? before.status, onMenu: change.onMenu ?? before.onMenu };
    if (next.onMenu && next.status === "PUBLISHED" && (!before.image || before.basketSlugs.length === 0 || !before.minutes)) {
      return { ok: false, code: "INVALID", error: "A menu recipe needs a photo, its Basket ingredients and a cooking time first." };
    }
    await prisma.recipe.update({ where: { id }, data: change });
    await auditStaff(ctx, {
      action: "recipes.visibility_changed",
      targetType: "Recipe",
      targetId: id,
      summary: `${before.title}: ${Object.entries(change).map(([k, v]) => `${k} ${String((before as Record<string, unknown>)[k])} → ${String(v)}`).join(", ")}`,
    });
    done(id);
    return { ok: true, data: undefined };
  });
}

/** The menu's order, as a list of recipe ids. */
export async function reorderMenu(ids: string[]): Promise<ActionResult> {
  return staffAction("recipes.publish", async (ctx) => {
    const parsed = z.array(z.string().max(40)).min(1).max(200).safeParse(ids);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That order isn't valid." };
    await prisma.$transaction(parsed.data.map((id, i) => prisma.recipe.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })));
    await auditStaff(ctx, { action: "recipes.reordered", summary: `Menu order changed (${parsed.data.length} recipes)` });
    done();
    return { ok: true, data: undefined };
  });
}

export async function signRecipeUpload(name: string): Promise<ActionResult<SignedUpload>> {
  return staffAction("recipes.edit", async () => {
    const signed = signImageUpload("recipes", String(name).slice(0, 80));
    if (!signed) return { ok: false, code: "ERROR", error: "Photo uploads aren't set up on this server (Cloudinary keys missing)." };
    return { ok: true, data: signed };
  });
}

/** Turns an uploaded public id into the image URL the recipe stores. */
export async function recipeImageUrl(publicId: string): Promise<ActionResult<{ url: string }>> {
  return staffAction("recipes.edit", async () => {
    const id = String(publicId).slice(0, 200);
    if (!isOurPublicId(id, "recipes")) return { ok: false, code: "INVALID", error: "That isn't one of our recipe photos." };
    return { ok: true, data: { url: cloudinaryUrl(id) } };
  });
}
