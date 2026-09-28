import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getActiveBasketReadOnly } from "@/lib/basket";
import {
  createThread,
  getOwnedThread,
  appendMessage,
  deriveTitle,
  recentMessagesForModel,
} from "@/lib/assistant-threads";
import type { AssistantThreadSource } from "@/generated/prisma/enums";
import {
  toolGetBasketContents,
  toolAddItemToBasket,
  toolAddItemsToBasket,
  toolRemoveItemFromBasket,
  toolAdjustItemQuantity,
  toolSwitchActiveBasket,
  toolCreateBasket,
  toolGetOrderStatus,
  toolGetDeliveryZone,
  toolGetCartContents,
  toolAddItemsToCart,
  toolRemoveItemFromCart,
  toolAdjustCartItemQuantity,
  listBasketsForContext,
} from "@/lib/assistant-tools";

// Verified at ai.google.dev on 2026-09-27 as the current fast/cheap model
// that's free-tier eligible and supports function calling. Model names on
// the free tier shift; override with ASSISTANT_MODEL_ID rather than editing
// this file when Google moves on again.
const MODEL_ID = process.env.ASSISTANT_MODEL_ID || "gemini-3.8-flash";

const VALID_SOURCES: AssistantThreadSource[] = [
  "ASSISTANT",
  "BASKET_SHEET",
  "CART_SHEET",
  "MEAL_PLANNER",
  "PRODUCE_PLANNER",
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to use Kachi." }, { status: 401 });
  }

  // Our own budget on top of Gemini's: cheap to check, and it means most
  // "too many requests" moments never even reach the provider.
  const ip = await clientIp();
  if (!rateLimit(`assistant:user:${user.id}`, 20, 60 * 1000).ok || !rateLimit(`assistant:ip:${ip}`, 60, 60 * 1000).ok) {
    return NextResponse.json({ reply: "Give me a second and try again." }, { status: 429 });
  }

  let body: { message?: unknown; threadId?: unknown; source?: unknown; contextRef?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const requestedThreadId = typeof body.threadId === "string" ? body.threadId : null;
  const source =
    typeof body.source === "string" && VALID_SOURCES.includes(body.source as AssistantThreadSource)
      ? (body.source as AssistantThreadSource)
      : "ASSISTANT";
  const contextRef = typeof body.contextRef === "string" ? body.contextRef.slice(0, 200) : null;

  let thread = requestedThreadId ? await getOwnedThread(user.id, requestedThreadId) : null;
  const history = thread ? await recentMessagesForModel(thread.id, 20) : [];
  if (!thread) {
    thread = await getOwnedThread(user.id, (await createThread(user.id, { title: deriveTitle(message), source, contextRef })).id);
  }
  if (!thread) {
    return NextResponse.json({ error: "Couldn't start that chat." }, { status: 500 });
  }
  const threadId = thread.id;

  await appendMessage(threadId, "USER", message);

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
  const systemPrompt = `You are Kachi, Basket's ordering assistant. Never call yourself "AI", a "bot", or a "chatbot" to the customer — you're Kachi.

You help with exactly one thing: this signed-in customer's own basket(s) and cart. Use the tools you're given to look things up and make real changes — don't just describe what you would do, actually call the tool. Prefer the batch tools (add_items_to_basket, add_items_to_cart) when adding more than one product, so it costs one call, not several.

Recipes and general "what should I cook" guidance are a separate part of the app, not your job. If asked, say so briefly and point them to Recipes.

Always pass the exact product id from the catalogue below to a tool, never the product name. Never invent a basket id, product id, or order id that doesn't appear below or in a tool result.

If the customer doesn't say which basket, use their most recently active one: ${activeBasket?.id ?? "(none yet)"}.

Customer's baskets (id :: pricing, ship day):
${basketLines}

Product catalogue (id :: name (unit, min order, step)):
${catalogueLines}`;

  const itemsShape = z.array(z.object({ product_id: z.string(), quantity: z.number().positive() }));

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
    add_items_to_basket: tool({
      description: "Add several products to one of this customer's own baskets in one call.",
      inputSchema: z.object({ basket_id: z.string(), items: itemsShape }),
      execute: async (input) => toolAddItemsToBasket(user, input),
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
    get_cart_contents: tool({
      description: "Read the items in this customer's one-off cart (separate from their baskets).",
      inputSchema: z.object({}),
      execute: async () => toolGetCartContents(user),
    }),
    add_items_to_cart: tool({
      description: "Add one or more products to this customer's cart, on top of whatever quantity is already there.",
      inputSchema: z.object({ items: itemsShape }),
      execute: async (input) => toolAddItemsToCart(user, input),
    }),
    remove_item_from_cart: tool({
      description: "Remove a product entirely from this customer's cart.",
      inputSchema: z.object({ product_id: z.string() }),
      execute: async (input) => toolRemoveItemFromCart(user, input),
    }),
    adjust_cart_item_quantity: tool({
      description: "Set a product in this customer's cart to an exact quantity.",
      inputSchema: z.object({ product_id: z.string(), quantity: z.number().min(0) }),
      execute: async (input) => toolAdjustCartItemQuantity(user, input),
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

    const reply = result.text || "Done.";
    const toolCallSummary = result.steps
      ?.flatMap((s) => s.toolCalls ?? [])
      .map((c) => ({ tool: c.toolName, input: c.input }));
    await appendMessage(threadId, "ASSISTANT", reply, toolCallSummary?.length ? toolCallSummary : undefined);

    return NextResponse.json({ reply, threadId, title: thread.title });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (/429|rate.?limit|quota/i.test(detail)) {
      const reply = "I'm a little busy right now — give me a second and try again.";
      await appendMessage(threadId, "ASSISTANT", reply);
      return NextResponse.json({ reply, threadId, title: thread.title }, { status: 429 });
    }
    console.error(JSON.stringify({ scope: "assistant-route", userId: user.id, error: detail }));
    const reply = "Something went wrong on my side. Try again in a moment.";
    await appendMessage(threadId, "ASSISTANT", reply);
    return NextResponse.json({ reply, threadId, title: thread.title }, { status: 500 });
  }
}
