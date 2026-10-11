import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs, type StopCondition, type ToolSet } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
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
  type ToolResult,
} from "@/lib/assistant-tools";
import {
  resolveScope,
  snapshot,
  diffSnapshots,
  buildListItems,
  recentOrders,
  toKachiOrder,
  chatSystemPrompt,
  actingSystemPrompt,
  aboutCustomer,
  activeBasketContext,
  contentsContext,
  extractRecipes,
  recipeLibrary,
  ORDER_INTENT,
  CHANGE_INTENT,
} from "@/lib/kachi";
import { OFFERED } from "@/lib/product";
import type { KachiCard, KachiMode, KachiScope } from "@/lib/kachi-types";

// Verified at ai.google.dev on 2026-09-27 as the current fast/cheap model
// that's free-tier eligible and supports function calling. Model names on
// the free tier shift; override with ASSISTANT_MODEL_ID rather than editing
// this file when Google moves on again.
const MODEL_ID = process.env.ASSISTANT_MODEL_ID || "gemini-3.8-flash";
// Free-tier quotas are counted per model, so when one runs dry for the day
// the next one usually still has room. Comma-separated, tried in order.
const FALLBACK_MODEL_IDS = (process.env.ASSISTANT_FALLBACK_MODEL_IDS ?? "gemini-3.7-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL_ID);

const VALID_SOURCES: AssistantThreadSource[] = [
  "ASSISTANT",
  "BASKET_SHEET",
  "CART_SHEET",
  "MEAL_PLANNER",
  "PRODUCE_PLANNER",
];

const itemsShape = z.array(z.object({ product_id: z.string(), quantity: z.number().positive() }));

function parseMode(raw: unknown): KachiMode | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.kind === "chat") return { kind: "chat" };
  if (m.kind === "cart") return { kind: "cart" };
  if (m.kind === "basket" && typeof m.basketId === "string") return { kind: "basket", basketId: m.basketId };
  return null;
}

function isRateLimited(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /429|rate.?limit|quota|resource.?exhausted/i.test(detail);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to use Kachi." }, { status: 401 });
  }

  // Our own budget on top of Gemini's: cheap to check, and it means most
  // "too many requests" moments never even reach the provider.
  const ip = await clientIp();
  if (!rateLimit(`assistant:user:${user.id}`, 20, 60 * 1000).ok || !rateLimit(`assistant:ip:${ip}`, 60, 60 * 1000).ok) {
    return NextResponse.json({ reply: "Give me a second and try again.", retry: true }, { status: 429 });
  }

  let body: {
    message?: unknown;
    threadId?: unknown;
    source?: unknown;
    contextRef?: unknown;
    mode?: unknown;
    replay?: unknown;
  };
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
  const mode = parseMode(body.mode);
  // A replay re-runs a request the customer already sent (after they picked
  // where it should go, or tapped Try again), so their message isn't stored
  // a second time.
  const replay = body.replay === true;

  let thread = requestedThreadId ? await getOwnedThread(user.id, requestedThreadId) : null;
  const history = thread ? await recentMessagesForModel(thread.id, 20) : [];
  if (!thread) {
    thread = await getOwnedThread(
      user.id,
      (
        await createThread(user.id, {
          title: deriveTitle(message),
          source,
          contextRef,
        })
      ).id,
    );
  }
  if (!thread) {
    return NextResponse.json({ error: "Couldn't start that chat." }, { status: 500 });
  }
  const threadId = thread.id;
  const title = thread.title;

  if (!replay) await appendMessage(threadId, "USER", message);

  // On a replay the message is already the last thing in the history.
  const last = history.at(-1);
  const messages =
    replay && last?.role === "user" && last.content === message
      ? history
      : [...history, { role: "user" as const, content: message }];

  if (!mode) return legacyReply(user, threadId, title, messages);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const profile = aboutCustomer(user);
  const [orders, library] = await Promise.all([recentOrders(user.id), recipeLibrary()]);
  const orderCard: KachiCard | null =
    ORDER_INTENT.test(message) && orders[0] ? { type: "order", order: toKachiOrder(orders[0]) } : null;

  const finish = async (reply: string, cards: KachiCard[], calls?: unknown, status = 200) => {
    // A bare failure isn't kept, so Try again replays onto a clean history.
    if (status < 400 || cards.length) {
      await appendMessage(threadId, "ASSISTANT", reply, cards.length || calls ? { cards, calls } : undefined);
    }
    return NextResponse.json({ reply, threadId, title, cards, retry: status >= 400 || undefined }, { status });
  };
  const failure = (err: unknown, cards: KachiCard[], where: string) => {
    if (isRateLimited(err))
      return finish("I am a little busy right now. Give me a few seconds and try again.", cards, undefined, 429);
    console.error(JSON.stringify({ scope: where, userId: user.id, error: String(err) }));
    return finish("Something went wrong on my side. Try again in a moment.", cards, undefined, 500);
  };
  // Recipe markers in a reply become recipe cards, and [[where]] (chat mode)
  // becomes the destination picker.
  const shape = (raw: string, extra: KachiCard[] = []) => {
    const wantsChange = /\[\[where\]\]/.test(raw);
    const { text, recipes } = extractRecipes(raw.replace(/\[\[where\]\]/g, ""), library.bySlug);
    const cards: KachiCard[] = [...extra];
    if (recipes.length) cards.push({ type: "recipes", recipes });
    if (wantsChange) cards.push({ type: "ask", request: message });
    if (orderCard) cards.push(orderCard);
    return { text, cards };
  };

  // Just chatting: Kachi can see the active basket, but nothing can change.
  // A plain "add X" skips the model and goes straight to the destination picker.
  if (mode.kind === "chat") {
    if (CHANGE_INTENT.test(message)) {
      return finish("I can do that. Where should it go?", [{ type: "ask", request: message }]);
    }
    try {
      const basket = await activeBasketContext(user.id);
      const result = await generate({
        system: chatSystemPrompt({
          firstName,
          profile,
          orders,
          basketLines: basket.lines,
          recipeLines: library.lines,
        }),
        messages,
      });
      const { text, cards } = shape(result.text);
      const asking = cards.some((c) => c.type === "ask");
      return finish(text || (asking ? "I can do that. Where should it go?" : "Tell me a little more?"), cards);
    } catch (err) {
      return failure(err, [], "kachi-chat");
    }
  }

  const scope = await resolveScope(user, mode);
  if (!scope) {
    return finish("I can't find that basket on your account. Pick another one with the button below.", []);
  }

  const before = await snapshot(scope);
  const products = await prisma.product.findMany({
    where: OFFERED,
    select: {
      id: true,
      name: true,
      unit: true,
      minOrderQty: true,
      stepQty: true,
    },
  });
  const catalogueLines = products
    .map((p) => `${p.id} :: ${p.name} (${p.unit}, min ${p.minOrderQty}, step ${p.stepQty})`)
    .join("\n");

  const byId = new Map(products.map((p) => [p.id, p]));

  // The shared setters snap to each product's minimum and step, so a request
  // can land right back where it started. Saying so lets Kachi explain,
  // instead of the turn ending on a change that never happened.
  const landed = async (productId: string, change: () => Promise<ToolResult>): Promise<ToolResult> => {
    const was = (await snapshot(scope)).get(productId) ?? 0;
    const result = await change();
    if (!result.ok) return result;
    const now = (await snapshot(scope)).get(productId) ?? 0;
    if (now !== was) return { ok: true, data: { ...(result.data as object), quantityNow: now } };
    const p = byId.get(productId);
    return {
      ok: false,
      error: p
        ? `Nothing changed: ${p.name} is sold from ${p.minOrderQty}, in steps of ${p.stepQty}, so that rounds back to ${now}. Tell the customer and offer the nearest amounts.`
        : "Nothing changed.",
    };
  };
  const proposals: { product_id: string; quantity: number }[] = [];
  let adds = 0;
  const oneAddOnly = {
    ok: false as const,
    error: "To add more than one product, call propose_items with the whole list instead.",
  };

  const propose_items = tool({
    description:
      "Show the customer a list of several products to add, for them to approve. Nothing is added until they tap Add all. Use this whenever you would add more than one product.",
    inputSchema: z.object({ items: itemsShape }),
    execute: async ({ items }) => {
      proposals.push(...items);
      return {
        ok: true,
        data: {
          shown: items.length,
          note: "Shown to the customer for approval. Nothing has been added.",
        },
      };
    },
  });
  const readOnly = {
    get_order_status: tool({
      description: "Look up the status of one of this customer's own past orders.",
      inputSchema: z.object({ order_id: z.string() }),
      execute: async (input) => toolGetOrderStatus(user, input),
    }),
  };

  // Every tool here is pinned to the one destination the customer picked;
  // the model never supplies a basket id, so it can't reach anything else.
  // Its contents are already in the prompt, so there is no lookup tool.
  const tools: ToolSet =
    scope.kind === "basket"
      ? {
          add_item_to_basket: tool({
            description: "Add a quantity of ONE product to the basket, on top of what is already there.",
            inputSchema: z.object({
              product_id: z.string(),
              quantity: z.number().positive(),
            }),
            execute: async (input) => {
              if (adds++ >= 1) return oneAddOnly;
              return landed(input.product_id, () => toolAddItemToBasket(user, { basket_id: scope.basketId, ...input }));
            },
          }),
          remove_item_from_basket: tool({
            description: "Remove a product entirely from the basket.",
            inputSchema: z.object({ product_id: z.string() }),
            execute: async (input) =>
              toolRemoveItemFromBasket(user, {
                basket_id: scope.basketId,
                ...input,
              }),
          }),
          adjust_item_quantity: tool({
            description: "Set a product already in the basket to an exact quantity. Use 0 to remove it.",
            inputSchema: z.object({
              product_id: z.string(),
              quantity: z.number().min(0),
            }),
            execute: async (input) => {
              if (!before.get(input.product_id) && adds++ >= 1) return oneAddOnly;
              return landed(input.product_id, () =>
                toolAdjustItemQuantity(user, { basket_id: scope.basketId, ...input }),
              );
            },
          }),
          propose_items,
          ...readOnly,
        }
      : {
          add_item_to_cart: tool({
            description: "Add a quantity of ONE product to the cart, on top of what is already there.",
            inputSchema: z.object({
              product_id: z.string(),
              quantity: z.number().positive(),
            }),
            execute: async (input) => {
              if (adds++ >= 1) return oneAddOnly;
              return landed(input.product_id, () => toolAddItemsToCart(user, { items: [input] }));
            },
          }),
          remove_item_from_cart: tool({
            description: "Remove a product entirely from the cart.",
            inputSchema: z.object({ product_id: z.string() }),
            execute: async (input) => toolRemoveItemFromCart(user, input),
          }),
          adjust_cart_item_quantity: tool({
            description: "Set a product already in the cart to an exact quantity. Use 0 to remove it.",
            inputSchema: z.object({
              product_id: z.string(),
              quantity: z.number().min(0),
            }),
            execute: async (input) => {
              if (!before.get(input.product_id) && adds++ >= 1) return oneAddOnly;
              return landed(input.product_id, () => toolAdjustCartItemQuantity(user, input));
            },
          }),
          propose_items,
          ...readOnly,
        };

  // Stops once a step did nothing but make changes that really landed (or
  // showed a list); a change that bounced goes back to the model to explain.
  const changedOnly: StopCondition<ToolSet> = async ({ steps }) => {
    const calls = steps.at(-1)?.toolCalls ?? [];
    if (calls.length === 0 || !calls.every((c) => CHANGE_TOOLS.has(c.toolName))) return false;
    return proposals.length > 0 || (await diffSnapshots(before, await snapshot(scope))).length > 0;
  };

  // The cart id is server-side only; the client just needs kind and name.
  const publicScope = stripCartId(scope);
  const collectCards = async () => {
    const changes = await diffSnapshots(before, await snapshot(scope));
    const cards: KachiCard[] = [];
    if (changes.length) cards.push({ type: "act", scope: publicScope, changes });
    if (proposals.length) {
      const items = await buildListItems(user, scope, proposals);
      if (items.length) cards.push({ type: "list", scope: publicScope, items });
    }
    return cards;
  };

  try {
    const result = await generate(
      {
        system: actingSystemPrompt({
          firstName,
          profile,
          scope,
          catalogueLines,
          orders,
          contentsLines: await contentsContext(before),
          recipeLines: library.lines,
        }),
        messages,
        tools,
        // A step that only made changes needs no follow-up call to say so:
        // the action card says it, which halves the calls on most edits.
        stopWhen: [stepCountIs(5), changedOnly],
      },
      // Proposals are only collected, so re-running is safe until something
      // real changed; a re-run starts the turn's bookkeeping over.
      async () => {
        const clean = (await diffSnapshots(before, await snapshot(scope))).length === 0;
        if (clean) {
          adds = 0;
          proposals.length = 0;
        }
        return clean;
      },
    );
    const calls = result.steps?.flatMap((s) => s.toolCalls ?? []).map((c) => ({ tool: c.toolName, input: c.input }));
    const changeCards = await collectCards();
    const { text, cards } = shape(result.text, changeCards);
    return finish(text || confirmation(changeCards), cards, calls?.length ? calls : undefined);
  } catch (err) {
    // Anything already changed before the failure still gets its card and Undo.
    return failure(err, await collectCards(), "kachi-acting");
  }
}

const CHANGE_TOOLS = new Set([
  "add_item_to_basket",
  "remove_item_from_basket",
  "adjust_item_quantity",
  "add_item_to_cart",
  "remove_item_from_cart",
  "adjust_cart_item_quantity",
  "propose_items",
]);

/** The reply when the model stopped at its change and wrote nothing itself. */
function confirmation(cards: KachiCard[]) {
  if (cards.some((c) => c.type === "list")) return "Here is what I would add. Nothing goes in until you say so.";
  if (cards.some((c) => c.type === "act")) return "Done. You can undo it below if that's not right.";
  return "I couldn't make that change. Try saying it another way?";
}

/**
 * generateText that rides out Gemini's free-tier limits. Its 429 says how
 * long to wait: a short wait (the per-minute limit) is waited out once on
 * the same model; a long one (the daily quota) moves to the next model.
 * A retry re-runs the whole turn, so `canRetry` says no once a tool has
 * changed something, rather than risk making the change twice.
 */
/** Per server instance: when each model's daily quota should be back. */
const exhaustedUntil = new Map<string, number>();

async function generate(
  opts: Omit<Parameters<typeof generateText>[0], "model">,
  canRetry: () => boolean | Promise<boolean> = () => true,
) {
  const run = (modelId: string) =>
    generateText({
      ...opts,
      model: google(modelId),
      maxRetries: 1,
    } as Parameters<typeof generateText>[0]);
  let lastErr: unknown;
  const models = [MODEL_ID, ...FALLBACK_MODEL_IDS];
  // Skip models known to be out of quota, unless that would leave none.
  const ready = models.filter((m) => (exhaustedUntil.get(m) ?? 0) <= Date.now());
  for (const modelId of ready.length ? ready : models) {
    try {
      return await run(modelId);
    } catch (err) {
      if (!isRateLimited(err) || !(await canRetry())) throw err;
      lastErr = err;
      const wait = retryDelayMs(err);
      console.warn(JSON.stringify({ scope: "kachi-rate-limit", model: modelId, waitMs: wait }));
      if (wait > 15_000) {
        exhaustedUntil.set(modelId, Date.now() + wait);
        continue;
      }
      await new Promise((r) => setTimeout(r, wait));
      try {
        return await run(modelId);
      } catch (again) {
        if (!isRateLimited(again) || !(await canRetry())) throw again;
        lastErr = again;
      }
    }
  }
  throw lastErr;
}

/** Gemini puts the wait in the error body, as "retryDelay": "23s". */
function retryDelayMs(err: unknown) {
  const seen = new Set<unknown>();
  let e: unknown = err;
  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e);
    const body = (e as { responseBody?: unknown }).responseBody;
    const m = typeof body === "string" ? body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/) : null;
    if (m) return Math.ceil(Number(m[1]) * 1000) + 250;
    e = (e as { lastError?: unknown }).lastError ?? (e as { cause?: unknown }).cause;
  }
  return 5_000;
}

function stripCartId(scope: KachiScope & { cartId?: string }): KachiScope {
  return scope.kind === "basket"
    ? { kind: "basket", basketId: scope.basketId, name: scope.name }
    : { kind: "cart", name: scope.name };
}

/**
 * The original unscoped behavior, still used by the basket page's "Get
 * ideas" chat, which sends no mode: every basket and cart tool, any basket.
 */
async function legacyReply(
  user: CurrentUser,
  threadId: string,
  title: string,
  messages: { role: "user" | "assistant"; content: string }[],
) {
  const [products, baskets, activeBasket] = await Promise.all([
    prisma.product.findMany({
      where: OFFERED,
      select: {
        id: true,
        name: true,
        unit: true,
        minOrderQty: true,
        stepQty: true,
      },
    }),
    listBasketsForContext(user),
    getActiveBasketReadOnly(user.id),
  ]);

  const catalogueLines = products
    .map((p) => `${p.id} :: ${p.name} (${p.unit}, min ${p.minOrderQty}, step ${p.stepQty})`)
    .join("\n");
  const basketLines = baskets.length
    ? baskets
        .map(
          (b) =>
            `${b.id} :: ${b.isFreeTrial ? "free trial, standard" : b.pricingMode.toLowerCase()} pricing, ships ${b.shipDay ?? "no day set"}`,
        )
        .join("\n")
    : "This customer has no basket yet. Offer to create one.";

  // Every rule the model gets is one the tools below re-check independently;
  // this prompt is context and a nudge, never the actual authorization
  // boundary. See assistant-tools.ts for the boundary that actually matters.
  const systemPrompt = `You are Kachi, Basket's ordering helper. Never call yourself "AI", a "bot", or a "chatbot" to the customer. You are Kachi. Never use em dashes; use commas or full stops instead.

You help with exactly one thing: this signed-in customer's own basket(s) and cart. Use the tools you're given to look things up and make real changes. Don't just describe what you would do, actually call the tool. Prefer the batch tools (add_items_to_basket, add_items_to_cart) when adding more than one product, so it costs one call, not several.

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
        "Create a new basket for this customer. A non-subscriber can only ever have one basket, so this will fail for them if they already have one.",
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
      inputSchema: z.object({
        product_id: z.string(),
        quantity: z.number().min(0),
      }),
      execute: async (input) => toolAdjustCartItemQuantity(user, input),
    }),
  };

  try {
    // Any of these tools can change a basket, so the rate-limit retry only
    // re-runs a turn that hasn't called one yet.
    let touched = false;
    const result = await generate(
      {
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(6),
        onStepEnd: (step) => {
          if (step.toolCalls.length) touched = true;
        },
      },
      () => !touched,
    );

    const reply = result.text || "Done.";
    const toolCallSummary = result.steps
      ?.flatMap((s) => s.toolCalls ?? [])
      .map((c) => ({ tool: c.toolName, input: c.input }));
    await appendMessage(threadId, "ASSISTANT", reply, toolCallSummary?.length ? toolCallSummary : undefined);

    return NextResponse.json({ reply, threadId, title });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (isRateLimited(err)) {
      const reply = "I am a little busy right now. Give me a second and try again.";
      await appendMessage(threadId, "ASSISTANT", reply);
      return NextResponse.json({ reply, threadId, title }, { status: 429 });
    }
    console.error(
      JSON.stringify({
        scope: "assistant-route",
        userId: user.id,
        error: detail,
      }),
    );
    const reply = "Something went wrong on my side. Try again in a moment.";
    await appendMessage(threadId, "ASSISTANT", reply);
    return NextResponse.json({ reply, threadId, title }, { status: 500 });
  }
}
