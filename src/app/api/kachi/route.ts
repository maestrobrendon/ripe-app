import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";
import { OFFERED } from "@/lib/product";
import { generate, isRateLimited } from "@/lib/kachi-model";
import { VOICE, RECIPE_RULES, NEXT_RULE, parseNext, recipeLibrary, extractRecipes } from "@/lib/kachi";
import type { KachiRecipe } from "@/lib/kachi-types";

/**
 * Kachi for visitors without an account: the floating bubble's brain before
 * sign-up. It knows what the public site knows (the menu, every price, the
 * plans, where we deliver) and can change nothing. Stateless: the bubble
 * sends the last few turns with each message. Signed-in visitors use
 * api/assistant instead, which knows their basket.
 */

export type GuestKachiReply = {
  reply: string;
  recipes: KachiRecipe[];
  /** Up to two short follow-ups the visitor can tap. */
  suggestions: string[];
  retry?: boolean;
};

type Turn = { role: "user" | "assistant"; content: string };

const GUEST_RULES = `The person you're talking to is browsing Basket's website and doesn't have an account yet.

You can answer questions about food and cooking, the recipes, produce and prices, the plans, and delivery. You can't see or change any basket, cart or order. If they want to order, save a recipe, or get produce delivered, tell them the next step in one sentence: "Get started" builds their first basket around a goal, free, and nothing is charged until they check out. Don't push it in every reply; only when it is the natural next step.

Never invent prices, products, areas or plan details; use only what is listed below. If something isn't listed, say you'll leave that to the team on WhatsApp.

${NEXT_RULE}`;

async function knowledge() {
  const [products, tiers, zones] = await Promise.all([
    prisma.product.findMany({
      where: OFFERED,
      select: { name: true, unit: true, standardPrice: true, memberPrice: true, inSeason: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true, monthlyFee: true, perks: true } }),
    prisma.deliveryZone.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true, area: true, isServed: true, deliveryDays: true } }),
  ]);
  const productLines = products
    .map(
      (p) =>
        `${p.name} (${p.unit}): ${formatNaira(p.standardPrice)}, members ${formatNaira(p.memberPrice)}${p.inSeason ? "" : ", off-season"}${p.category === "BOX_BUNDLE" ? ", ready-made box" : ""}`,
    )
    .join("\n");
  const planLines = [
    "Pay as you go: no fee, standard prices, most recipes, one trial basket, delivery priced by area.",
    ...tiers.map((t) => `${t.name}: ${formatNaira(t.monthlyFee)} a month, paid once a month. ${t.perks.join("; ")}.`),
  ].join("\n");
  const zoneLines = zones
    .map((z) =>
      z.isServed
        ? `${z.name} (${z.area}): delivers ${z.deliveryDays.map((d) => DELIVERY_DAY_LABEL[d] ?? d).join(", ")}, 9am to 5pm`
        : `${z.name}: coming soon, not delivering yet`,
    )
    .join("\n");
  return `Produce and prices (standard, then member):
${productLines}

Plans:
${planLines}

Delivery: each area has its own delivery fee, shown before paying. Free on Member Plus. Orders can be changed until the night before, and a skipped week costs nothing.
Areas:
${zoneLines}`;
}


export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`kachi-guest:ip:${ip}`, 12, 60 * 1000).ok) {
    return NextResponse.json<GuestKachiReply>({ reply: "Give me a second and ask again.", recipes: [], suggestions: [], retry: true }, { status: 429 });
  }

  let body: { messages?: unknown; page?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const messages: Turn[] = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (m): m is Turn =>
            Boolean(m) && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
        )
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }))
    : [];
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;

  const [library, facts] = await Promise.all([recipeLibrary(), knowledge()]);

  try {
    const result = await generate({
      system: `${VOICE}

${GUEST_RULES}
${page ? `\nThey are looking at this page right now: ${page}. If their question is vague ("this", "it"), it is probably about that.\n` : ""}
${RECIPE_RULES}

Recipe library:
${library.lines}

${facts}`,
      messages,
    });
    const { text: withoutNext, suggestions } = parseNext(result.text);
    const { text, recipes } = extractRecipes(withoutNext, library.bySlug);
    return NextResponse.json<GuestKachiReply>({ reply: text || "Tell me a little more?", recipes, suggestions });
  } catch (err) {
    if (isRateLimited(err)) {
      return NextResponse.json<GuestKachiReply>({ reply: "I'm a little busy right now. Give me a few seconds and try again.", recipes: [], suggestions: [], retry: true }, { status: 429 });
    }
    console.error(JSON.stringify({ scope: "kachi-guest", error: String(err) }));
    return NextResponse.json<GuestKachiReply>({ reply: "Something went wrong on my side. Try again in a moment.", recipes: [], suggestions: [], retry: true }, { status: 500 });
  }
}
