import "server-only";
import { Output } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { generate, kachiInstructions } from "@/lib/kachi-model";
import { aboutCustomer, recipeLibrary, VOICE } from "@/lib/kachi";
import { knownAboutCustomer, listMemories } from "@/lib/kachi-memory";
import { priceFor, writeDeliveryLine } from "@/lib/order-container";
import { BUYABLE, isBuyable, snapQuantity } from "@/lib/product";
import { formatNaira } from "@/lib/format";

/*
 * Kachi's weekly suggestion for a repeating basket. Made with the "your
 * basket is ready" reminder (api/cron/reminders), three days before the
 * delivery: she looks at what's in the basket, what's out of stock, what got
 * cheaper and what's plentiful this week, and what she knows about the
 * customer, and suggests a few changes. Nothing changes until they tap Use
 * these changes on Home, and they still confirm and pay themselves.
 *
 * What she suggests is checked here before it's kept: real products, in
 * stock, quantities a customer could pick, nothing matching an allergy or a
 * food they don't eat, and at most MAX_CHANGES.
 */

export type DraftChange = { productId: string; before: number; after: number; why: string };

const MAX_CHANGES = 4;
/** How far back a price cut still counts as news. */
const PRICE_NEWS_DAYS = 14;

const SUGGESTION = z.object({
  note: z.string().describe("One or two short sentences to the customer, in your voice, saying what you changed and why. If you changed nothing, say their basket looks good as it is."),
  changes: z
    .array(
      z.object({
        product_id: z.string(),
        quantity: z.number().describe("The new quantity for this product. 0 removes it."),
        why: z.string().describe("A few words, e.g. 'out of stock this week', 'price is down', 'plenty this week'."),
      }),
    )
    .describe(`At most ${MAX_CHANGES} changes. Empty if the basket is good as it is.`),
  recipe: z.string().nullable().describe("The slug of one recipe from the library that fits the suggested basket, or null."),
});

const RULES = `You are preparing a customer's repeating basket for their next delivery. Suggest a few changes they can accept with one tap, or none.

What to do:
- Anything in their basket that is out of stock this week must go. Replace it with something of the same kind that is in stock (set the sold-out one to 0 and add the replacement).
- You may suggest one or two products that are good this week: price down, or plenty in stock. Prefer things they like or usually buy, and things that fit their goal.
- Respect what they chose. Never lower or remove something they picked unless it's out of stock this week, and don't tidy up quantities: they set those on purpose. Don't empty or rebuild the basket: at most ${MAX_CHANGES} changes in total.
- For anything you add, size the quantity for their household.
- Never suggest anything they're allergic to or don't eat, and never anything that isn't in the product list below.
- No drinks, smoothies or juices.
- If their basket is already good, return no changes and say so warmly.
- The note is one or two short sentences. Never use em dashes. Don't mention prices to the naira; "price is down" is enough.`;

type BasketForDraft = { id: string; userId: string; name: string | null; items: { productId: string; quantity: number; product: { name: string; unit: string; availability: string; tags: string[]; memberPrice: number; standardPrice: number } }[] };

/** What's worth knowing about the market this week, per product: price cuts and plenty in stock. */
async function marketThisWeek() {
  const since = new Date(Date.now() - PRICE_NEWS_DAYS * 86_400_000);
  const [products, cuts] = await Promise.all([
    prisma.product.findMany({ where: BUYABLE, orderBy: { name: "asc" } }),
    prisma.priceChange.findMany({ where: { at: { gte: since }, field: { in: ["memberPrice", "standardPrice"] } }, orderBy: { at: "asc" } }),
  ]);
  // The overall change across the window, from the first old price to the latest new one.
  const span = new Map<string, { from: number; to: number }>();
  for (const c of cuts) {
    if (c.fromValue == null || c.toValue == null) continue;
    const s = span.get(c.productId);
    span.set(c.productId, { from: s?.from ?? c.fromValue, to: c.toValue });
  }
  return products.map((p) => {
    const s = span.get(p.id);
    const down = s && s.to < s.from ? Math.round(((s.from - s.to) / s.from) * 100) : 0;
    const plenty = p.availability === "AVAILABLE" && p.stockOnHand > 0 && (p.reorderPoint == null || p.stockOnHand > p.reorderPoint * 2);
    const limited = p.availability === "LIMITED" || (p.reorderPoint != null && p.stockOnHand <= p.reorderPoint);
    return { product: p, down, plenty, limited };
  });
}

/** True when a product's name shows up in an allergy or don't-eat note ("No okra" vs "Okra"). */
function clashes(name: string, notes: string[]) {
  const n = name.toLowerCase().replace(/\s*\(.*\)$/, "").trim();
  const head = n.split(/\s+/)[0];
  return notes.some((t) => t.includes(n) || (head.length > 3 && t.includes(head)));
}

/**
 * Makes (or returns the existing) suggestion for this basket and delivery
 * date. Returns null when there's nothing to suggest on, and never throws
 * into the reminder that calls it.
 */
export async function ensureDraft(basket: BasketForDraft, deliveryDate: Date) {
  const existing = await prisma.kachiDraft.findUnique({ where: { basketId_deliveryDate: { basketId: basket.id, deliveryDate } } });
  if (existing) return existing;

  const user = (await prisma.user.findUnique({ where: { id: basket.userId }, include: { subscriptionTier: true, deliveryZone: true, preferences: true } })) as CurrentUser | null;
  if (!user) return null;
  const member = Boolean(user.subscriptionTierId);

  const [market, library, known, memories] = await Promise.all([marketThisWeek(), recipeLibrary(), knownAboutCustomer(user), listMemories(user.id)]);
  const inBasket = new Map(basket.items.map((i) => [i.productId, i]));
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  const basketLines = basket.items
    .map((i) => `${i.productId} :: ${i.product.name}, ${i.quantity} x ${i.product.unit}${isBuyable(i.product) ? "" : " (OUT OF STOCK this week)"}`)
    .join("\n");
  const productLines = market
    .map(({ product: p, down, plenty, limited }) => {
      const notes = [down ? `price down ${down}%` : null, plenty ? "plenty in stock" : null, limited ? "limited" : null].filter(Boolean).join(", ");
      return `${p.id} :: ${p.name} (${p.category.toLowerCase()}, ${p.unit}, ${formatNaira(priceFor(p, member))}, min ${p.minOrderQty}, step ${p.stepQty})${notes ? ` [${notes}]` : ""}`;
    })
    .join("\n");

  const result = await generate({
    system: kachiInstructions(
      `${VOICE}\n\n${RULES}\n\nRecipe library:\n${library.lines}`,
      `The customer is ${firstName}.\n${aboutCustomer(user)}\n${known}\n\nTheir basket${basket.name ? ` "${basket.name}"` : ""} now (id :: name, quantity x unit):\n${basketLines}\n\nProducts on sale this week (id :: name (kind, unit, price, min, step) [this week]):\n${productLines}`,
    ),
    prompt: "Prepare their basket for next delivery.",
    output: Output.object({ schema: SUGGESTION }),
  });
  const suggestion = result.output as z.infer<typeof SUGGESTION> | undefined;
  if (!suggestion) return null;

  // Check every change before keeping it.
  const byId = new Map(market.map((m) => [m.product.id, m.product]));
  const avoid = memories.filter((m) => m.kind === "ALLERGY" || m.kind === "DISLIKE").map((m) => m.text.toLowerCase());
  if (user.preferences?.dietaryNotes) avoid.push(user.preferences.dietaryNotes.toLowerCase());
  const changes: DraftChange[] = [];
  for (const c of suggestion.changes) {
    if (changes.length >= MAX_CHANGES || changes.some((x) => x.productId === c.product_id)) continue;
    const line = inBasket.get(c.product_id);
    const before = line?.quantity ?? 0;
    const product = byId.get(c.product_id);
    let after = 0;
    if (c.quantity > 0) {
      // Adding or raising needs a product we can sell, that doesn't clash with what they've told us.
      if (!product || clashes(product.name, avoid)) continue;
      after = snapQuantity(c.quantity, product);
    } else if (!line) continue;
    if (after === before) continue;
    changes.push({ productId: c.product_id, before, after, why: c.why.trim().slice(0, 60) });
  }
  const recipeSlug = suggestion.recipe && library.bySlug.has(suggestion.recipe) ? suggestion.recipe : null;
  const note = suggestion.note.replace(/\s*—\s*/g, ", ").trim().slice(0, 300) || "Your basket looks good as it is.";

  return prisma.kachiDraft.upsert({
    where: { basketId_deliveryDate: { basketId: basket.id, deliveryDate } },
    update: {},
    create: { userId: user.id, basketId: basket.id, deliveryDate, note, changes, recipeSlug },
  });
}

export const draftChanges = (raw: unknown): DraftChange[] => (Array.isArray(raw) ? (raw as DraftChange[]) : []);

/** How long after Use these changes Home still shows the card, so its Undo survives a refresh. */
const UNDO_WINDOW_MS = 15 * 60_000;

/**
 * The suggestion Home shows for this basket's next delivery: one waiting for
 * an answer, or one just used (still undoable).
 */
export async function homeDraft(userId: string, basketId: string, deliveryDate: Date, cutoff: Date) {
  // After the cutoff the basket can't change, so there's nothing to suggest.
  if (Date.now() >= cutoff.getTime()) return null;
  const d = await prisma.kachiDraft.findFirst({
    where: {
      userId,
      basketId,
      deliveryDate,
      OR: [{ status: "PENDING" }, { status: "ACCEPTED", decidedAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } }],
    },
  });
  return d && draftChanges(d.changes).length ? d : null;
}

export type DraftResult = { ok: true; skipped: string[] } | { ok: false; error: string };

/**
 * Use these changes: sets each line to Kachi's quantity. Something that sold
 * out since she suggested it is left as it was and named, so nothing changes
 * silently.
 */
export async function acceptDraft(userId: string, draftId: string): Promise<DraftResult> {
  const d = await prisma.kachiDraft.findFirst({ where: { id: draftId, userId, status: "PENDING" } });
  if (!d) return { ok: false, error: "That suggestion has already been used or has expired." };
  const skipped: string[] = [];
  for (const c of draftChanges(d.changes)) {
    try {
      await writeDeliveryLine(d.basketId, c.productId, c.after, "set");
    } catch (e) {
      skipped.push(e instanceof Error ? e.message : "One item couldn't be changed.");
    }
  }
  await prisma.kachiDraft.update({ where: { id: d.id }, data: { status: "ACCEPTED", decidedAt: new Date() } });
  return { ok: true, skipped };
}

/** Undo after Use these changes: each line goes back to what it was, and the suggestion waits again. */
export async function undoDraft(userId: string, draftId: string): Promise<DraftResult> {
  const d = await prisma.kachiDraft.findFirst({ where: { id: draftId, userId, status: "ACCEPTED" } });
  if (!d) return { ok: false, error: "There's nothing to undo." };
  for (const c of draftChanges(d.changes)) {
    await writeDeliveryLine(d.basketId, c.productId, c.before, "set").catch(() => {});
  }
  await prisma.kachiDraft.update({ where: { id: d.id }, data: { status: "PENDING", decidedAt: null } });
  return { ok: true, skipped: [] };
}

export async function dismissDraft(userId: string, draftId: string): Promise<DraftResult> {
  const { count } = await prisma.kachiDraft.updateMany({ where: { id: draftId, userId, status: "PENDING" }, data: { status: "DISMISSED", decidedAt: new Date() } });
  return count ? { ok: true, skipped: [] } : { ok: false, error: "That suggestion has already been used or has expired." };
}
