import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getActiveBasketReadOnly } from "@/lib/basket";
import {
  toolGetBasketContents,
  toolAddItemToBasket,
  toolRemoveItemFromBasket,
  toolAdjustItemQuantity,
  toolSwitchActiveBasket,
  toolCreateBasket,
  toolGetOrderStatus,
  toolGetDeliveryZone,
  listBasketsForContext,
} from "@/lib/assistant-tools";

// Verified at ai.google.dev on 2026-09-27 as the current fast/cheap model
// that's free-tier eligible and supports function calling. Model names on
// the free tier shift; override with ASSISTANT_MODEL_ID rather than editing
// this file when Google moves on again.
const MODEL_ID = process.env.ASSISTANT_MODEL_ID || "gemini-3.8-flash";

type ChatTurn = { role: "user" | "assistant"; content: string };

function isChatTurn(v: unknown): v is ChatTurn {
  return (
    typeof v === "object" &&
    v !== null &&
    ((v as ChatTurn).role === "user" || (v as ChatTurn).role === "assistant") &&
    typeof (v as ChatTurn).content === "string"
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  }

  // Our own budget on top of Gemini's: cheap to check, and it means most
  // "too many requests" moments never even reach the provider.
  const ip = await clientIp();
  if (!rateLimit(`assistant:user:${user.id}`, 20, 60 * 1000).ok || !rateLimit(`assistant:ip:${ip}`, 60, 60 * 1000).ok) {
    return NextResponse.json({ reply: "Give me a second and try again." }, { status: 429 });
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(isChatTurn)
    .slice(-20)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));

  const [products, baskets, activeBasket] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, unit: true, minOrderQty: true, stepQty: true },
    }),
    listBasketsForContext(user),
    getActiveBasketReadOnly(user.id),
  ]);

  const catalogueLines = products
    .map((p) => `${p.id} :: ${p.name} (${p.unit}, min ${p.minOrderQty}, step ${p.stepQty})`)
    .join("\n");
  const basketLines = baskets.length
    ? baskets
        .map((b) => `${b.id} :: ${b.isFreeTrial ? "free trial, standard" : b.pricingMode.toLowerCase()} pricing, ships ${b.shipDay ?? "no day set"}`)
        .join("\n")
    : "This customer has no basket yet — offer to create one.";

  // Every rule the model gets is one the tools below re-check independently;
  // this prompt is context and a nudge, never the actual authorization
  // boundary. See assistant-tools.ts for the boundary that actually matters.
  const systemPrompt = `You are Basket's ordering assistant. Never call yourself "AI", a "bot", or a "chatbot" to the customer; if asked what you are, say you're Basket's assistant.

You help with exactly one thing: this signed-in customer's own basket(s) and cart. Use the tools you're given to look things up and make real changes — don't just describe what you would do, actually call the tool.

Recipes and general "what should I cook" guidance are a separate part of the app, not your job. If asked, say so briefly and point them to Recipes.

Always pass the exact product id from the catalogue below to a tool, never the product name. Never invent a basket id, product id, or order id that doesn't appear below or in a tool result.

If the customer doesn't say which basket, use their most recently active one: ${activeBasket?.id ?? "(none yet)"}.

Customer's baskets (id :: pricing, ship day):
${basketLines}

Product catalogue (id :: name (unit, min order, step)):
${catalogueLines}`;

  const tools = {
    get_basket_contents: tool({
      description: "Read the items, ship day, and pricing of one of this customer's own baskets.",
      inputSchema: z.object({ basket_id: z.string() }),
      execute: async (input) => toolGetBasketContents(user, input),
    }),
    add_item_to_basket: tool({
      description:
        "Add a quantity of a product to one of this customer's own baskets, on top of whatever quantity is already there.",
      inputSchema: z.object({
        basket_id: z.string(),
        product_id: z.string(),
        quantity: z.number().positive(),
      }),
      execute: async (input) => toolAddItemToBasket(user, input),
    }),
    remove_item_from_basket: tool({
      description: "Remove a product entirely from one of this customer's own baskets.",
      inputSchema: z.object({ basket_id: z.string(), product_id: z.string() }),
      execute: async (input) => toolRemoveItemFromBasket(user, input),
    }),
    adjust_item_quantity: tool({
      description:
        "Set a product in one of this customer's own baskets to an exact quantity, replacing whatever is already there. Use add_item_to_basket instead when the customer means 'add N more'.",
      inputSchema: z.object({
        basket_id: z.string(),
        product_id: z.string(),
        quantity: z.number().min(0),
      }),
      execute: async (input) => toolAdjustItemQuantity(user, input),
    }),
    switch_active_basket: tool({
      description: "Make one of this customer's own baskets the active one.",
      inputSchema: z.object({ basket_id: z.string() }),
      execute: async (input) => toolSwitchActiveBasket(user, input),
    }),
    create_basket: tool({
      description:
        "Create a new basket for this customer. A non-subscriber can only ever have one basket, ever — this will fail for them if they already have one.",
      inputSchema: z.object({}),
      execute: async () => toolCreateBasket(user),
    }),
    get_order_status: tool({
      description: "Look up the status of one of this customer's own past orders.",
      inputSchema: z.object({ order_id: z.string() }),
      execute: async (input) => toolGetOrderStatus(user, input),
    }),
    get_delivery_zone: tool({
      description: "Look up this customer's delivery zone and delivery days.",
      inputSchema: z.object({}),
      execute: async () => toolGetDeliveryZone(user),
    }),
  };

  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system: systemPrompt,
      messages: [...history, { role: "user" as const, content: message }],
      tools,
      stopWhen: stepCountIs(6),
    });

    return NextResponse.json({ reply: result.text || "Done." });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (/429|rate.?limit|quota/i.test(detail)) {
      return NextResponse.json(
        { reply: "I'm a little busy right now — give me a second and try again." },
        { status: 429 },
      );
    }
    console.error(JSON.stringify({ scope: "assistant-route", userId: user.id, error: detail }));
    return NextResponse.json({ reply: "Something went wrong on my side. Try again in a moment." }, { status: 500 });
  }
}
