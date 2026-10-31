import { NextResponse } from "next/server";
import { tool, stepCountIs, type StopCondition, type ToolSet } from "ai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { generate, generateStreaming, isRateLimited } from "@/lib/kachi-model";
import {
  createThread,
  getOwnedThread,
  appendMessage,
  deriveTitle,
  recentMessagesForModel,
} from "@/lib/assistant-threads";
import type { AssistantThreadSource } from "@/generated/prisma/enums";
import {
  toolAddItemToBasket,
  toolRemoveItemFromBasket,
  toolAdjustItemQuantity,
  type ToolResult,
} from "@/lib/assistant-tools";
import {
  deliveryScope,
  snapshot,
  diffSnapshots,
  buildListItems,
  recentOrders,
  toKachiOrder,
  actingSystemPrompt,
  aboutCustomer,
  contentsContext,
  extractRecipes,
  recipeLibrary,
  parseNext,
  ORDER_INTENT,
} from "@/lib/kachi";
import { OFFERED } from "@/lib/product";
import { readPhoto } from "@/lib/kachi-photos";
import type { ModelMessage } from "ai";
import { addMemory, knownAboutCustomer, MEMORY_KINDS, MEMORY_TEXT_MAX, removeMemory } from "@/lib/kachi-memory";
import { accountContext, accountTools, orderStatusForKachi } from "@/lib/kachi-account";
import { customerStatusLabel } from "@/lib/order-status";
import { awaitingPayment } from "@/lib/order-copy";
import { DELIVERY_WINDOW, longDate } from "@/lib/delivery-labels";
import type { KachiCard, KachiReply, KachiScope } from "@/lib/kachi-types";


const VALID_SOURCES: AssistantThreadSource[] = [
  "ASSISTANT",
  "BASKET_SHEET",
  "CART_SHEET",
  "MEAL_PLANNER",
  "PRODUCE_PLANNER",
];

const itemsShape = z.array(z.object({ product_id: z.string(), quantity: z.number().positive() }));

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
    replay?: unknown;
    page?: unknown;
    stream?: unknown;
    image?: unknown;
    recentPhoto?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // A photo with this message goes to the model with it, and nowhere else (lib/kachi-photos.ts).
  const photo = readPhoto(body.image);
  // The last one they sent, kept by the chat for a few minutes, in case it belongs with a problem report.
  const reportPhoto = photo ?? readPhoto(body.recentPhoto);
  const message = (typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "") || (photo ? "What do you make of this?" : "");
  if (!message) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  // What's kept in the chat: the words, and a note that a photo came with them (the photo isn't kept).
  const stored = photo ? `${message}\n(sent a photo)` : message;

  const requestedThreadId = typeof body.threadId === "string" ? body.threadId : null;
  const source =
    typeof body.source === "string" && VALID_SOURCES.includes(body.source as AssistantThreadSource)
      ? (body.source as AssistantThreadSource)
      : "ASSISTANT";
  const contextRef = typeof body.contextRef === "string" ? body.contextRef.slice(0, 200) : null;
  // A replay re-runs a request the customer already sent (they tapped Try
  // again), so their message isn't stored a second time.
  const replay = body.replay === true;
  // Where the customer is, sent by the floating Kachi: "Chicken shawarma bowl recipe (/recipes/chicken-shawarma-bowl)".
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;
  // Sent as it's written (NDJSON: {"t":"d","v":words}… then {"t":"done",…the reply}), or all at once.
  const wantsStream = body.stream === true;

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

  if (!replay) await appendMessage(threadId, "USER", stored);

  // On a replay the message is already the last thing in the history.
  const last = history.at(-1);
  const earlier = replay && last?.role === "user" && last.content === stored ? history.slice(0, -1) : history;
  const turn: ModelMessage = photo
    ? { role: "user", content: [{ type: "image", image: photo.data, mediaType: photo.mediaType }, { type: "text", text: message }] }
    : { role: "user", content: message };
  const messages: ModelMessage[] = [...earlier, turn];

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const profile = aboutCustomer(user);
  const [orders, library, known] = await Promise.all([recentOrders(user.id), recipeLibrary(), knownAboutCustomer(user)]);
  const orderCard: KachiCard | null =
    ORDER_INTENT.test(message) && orders[0] ? { type: "order", order: toKachiOrder(orders[0]) } : null;

  const finish = async (reply: string, cards: KachiCard[], calls?: unknown, status = 200, suggestions: string[] = []) => {
    // A bare failure isn't kept, so Try again replays onto a clean history.
    if (status < 400 || cards.length) {
      await appendMessage(threadId, "ASSISTANT", reply, cards.length || calls ? { cards, calls } : undefined);
    }
    return { payload: { reply, threadId, title, cards, suggestions, retry: status >= 400 || undefined } as KachiReply, status };
  };
  const failure = (err: unknown, cards: KachiCard[], where: string) => {
    if (isRateLimited(err))
      return finish("Everyone wants fruit advice at once. Give me a few seconds and ask again?", cards, undefined, 429);
    console.error(JSON.stringify({ scope: where, userId: user.id, error: String(err) }));
    return finish("Something slipped on my side. Try that again in a moment?", cards, undefined, 500);
  };
  // Recipe markers in a reply become recipe cards.
  const shape = (raw: string, extra: KachiCard[] = []) => {
    const { text, recipes } = extractRecipes(raw, library.bySlug);
    const cards: KachiCard[] = [...extra];
    if (recipes.length) cards.push({ type: "recipes", recipes });
    // "Skip my next delivery" isn't asking where an order is.
    if (orderCard && !extra.some((c) => c.type === "account")) cards.push(orderCard);
    return { text, cards };
  };

  // One Kachi: food help, and changes to the order the customer is filling
  // (the same delivery the shop and recipes add to). Every tool is pinned to it.
  const scoped = await deliveryScope(user);
  const { scope, when } = scoped;

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
  // What she remembered or forgot this turn, each shown as a card with Undo.
  const memoryCards: KachiCard[] = [];
  const memoryTools = {
    remember: tool({
      description: "Remember something lasting the customer told you about their food or household, for every future chat. One short note per call.",
      inputSchema: z.object({
        kind: z.enum(MEMORY_KINDS),
        note: z.string().max(MEMORY_TEXT_MAX),
      }),
      execute: async ({ kind, note }) => {
        const r = await addMemory(user.id, kind, note);
        if (!r.ok) return r;
        if (!r.existing) memoryCards.push({ type: "memory", action: "remembered", memory: r.memory });
        return { ok: true, data: { id: r.memory.id, alreadyRemembered: r.existing } };
      },
    }),
    forget: tool({
      description: "Forget one thing you remember about the customer, by its id.",
      inputSchema: z.object({ memory_id: z.string() }),
      execute: async ({ memory_id }) => {
        const gone = await removeMemory(user.id, memory_id);
        if (!gone) return { ok: false, error: "There's no memory with that id." };
        memoryCards.push({ type: "memory", action: "forgot", memory: gone });
        return { ok: true, data: { forgot: gone.text } };
      },
    }),
  };

  // Skip, day, pause, rename and problem reports, each shown as a card (with Undo where it can be undone).
  const accountCards: KachiCard[] = [];
  const readOnly = {
    get_order_status: tool({
      description: "Look up one of this customer's own orders: its status, delivery date, whether it's paid, and the rider when it's on its way.",
      inputSchema: z.object({ order_id: z.string() }),
      execute: async ({ order_id }) => {
        const found = await orderStatusForKachi(user.id, order_id);
        if (!found) return { ok: false, error: "No order with that id on this account." };
        const { order, rider } = found;
        return {
          ok: true,
          data: {
            // What the customer sees on their order page; use these words with them.
            status: customerStatusLabel(order.status, awaitingPayment(order)),
            deliveryDate: longDate(order.deliveryDate),
            window: DELIVERY_WINDOW,
            deliveredAt: order.deliveredAt?.toISOString() ?? null,
            paid: Boolean(order.paidAt),
            rider: rider ? { name: rider.name, phone: rider.phone } : null,
          },
        };
      },
    }),
  };

  // Every tool here is pinned to the one destination the customer picked;
  // the model never supplies a basket id, so it can't reach anything else.
  // Its contents are already in the prompt, so there is no lookup tool.
  const tools: ToolSet = {
    add_item_to_basket: tool({
      description: "Add a quantity of ONE product to their order, on top of what is already there.",
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
      description: "Remove a product entirely from their order.",
      inputSchema: z.object({ product_id: z.string() }),
      execute: async (input) => toolRemoveItemFromBasket(user, { basket_id: scope.basketId, ...input }),
    }),
    adjust_item_quantity: tool({
      description: "Set a product already in their order to an exact quantity. Use 0 to remove it.",
      inputSchema: z.object({
        product_id: z.string(),
        quantity: z.number().min(0),
      }),
      execute: async (input) => {
        if (!before.get(input.product_id) && adds++ >= 1) return oneAddOnly;
        return landed(input.product_id, () => toolAdjustItemQuantity(user, { basket_id: scope.basketId, ...input }));
      },
    }),
    propose_items,
    ...memoryTools,
    ...accountTools(user, scoped, accountCards, reportPhoto),
    ...readOnly,
  };

  // Stops once a step did nothing but make changes that really landed (or
  // showed a list); a change that bounced goes back to the model to explain.
  const changedOnly: StopCondition<ToolSet> = async ({ steps }) => {
    const calls = steps.at(-1)?.toolCalls ?? [];
    if (calls.length === 0 || !calls.every((c) => CHANGE_TOOLS.has(c.toolName))) return false;
    return proposals.length > 0 || (await diffSnapshots(before, await snapshot(scope))).length > 0;
  };

  const publicScope: KachiScope = { kind: "basket", basketId: scope.basketId, name: scope.name };
  const collectCards = async () => {
    const changes = await diffSnapshots(before, await snapshot(scope));
    const cards: KachiCard[] = [];
    if (changes.length) cards.push({ type: "act", scope: publicScope, changes });
    cards.push(...memoryCards, ...accountCards);
    if (proposals.length) {
      const items = await buildListItems(user, scope, proposals);
      if (items.length) cards.push({ type: "list", scope: publicScope, items });
    }
    return cards;
  };

  // One turn of the conversation: with onText, her words go out as they're written.
  const runTurn = async (onText?: (delta: string) => void) => {
    try {
      const turn = {
        system: actingSystemPrompt({
          firstName,
          profile,
          scope,
          when,
          page,
          catalogueLines,
          orders,
          contentsLines: await contentsContext(before),
          recipeLines: library.lines,
          known,
          account: accountContext(user, scoped),
        }),
        messages,
        tools,
        // A step that only made changes needs no follow-up call to say so:
        // the action card says it, which halves the calls on most edits.
        stopWhen: [stepCountIs(5), changedOnly],
      };
      // Proposals are only collected, so re-running is safe until something
      // real changed; a re-run starts the turn's bookkeeping over.
      const canRetry = async () => {
        const clean = (await diffSnapshots(before, await snapshot(scope))).length === 0;
        if (clean) {
          adds = 0;
          proposals.length = 0;
        }
        return clean;
      };
      const result = onText ? await generateStreaming(turn as Parameters<typeof generateStreaming>[0], onText, canRetry) : await generate(turn, canRetry);
      // Each call with what it returned, so later turns replay what she really did (lib/assistant-threads.ts).
      const results = new Map((result.steps ?? []).flatMap((s) => s.toolResults ?? []).map((r) => [r.toolCallId, r.output]));
      const calls = result.steps?.flatMap((s) => s.toolCalls ?? []).map((c) => ({ tool: c.toolName, input: c.input, output: results.get(c.toolCallId) ?? null }));
      const changeCards = await collectCards();
      // The tappable replies Kachi offers come off the end of the text.
      const { text: said, suggestions } = parseNext(result.text);
      const { text, cards } = shape(said, changeCards);
      return finish(text || confirmation(changeCards), cards, calls?.length ? calls : undefined, 200, suggestions);
    } catch (err) {
      // Anything already changed before the failure still gets its card and Undo.
      return failure(err, await collectCards(), "kachi-acting");
    }
  };

  if (!wantsStream) {
    const { payload, status } = await runTurn();
    return NextResponse.json(payload, { status });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      const { payload, status } = await runTurn((delta) => send({ t: "d", v: delta }));
      send({ t: "done", status, ...payload });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

const CHANGE_TOOLS = new Set([
  "add_item_to_basket",
  "remove_item_from_basket",
  "adjust_item_quantity",
  "propose_items",
]);

/** The reply when the model stopped at its change and wrote nothing itself. */
function confirmation(cards: KachiCard[]) {
  if (cards.some((c) => c.type === "list")) return "Here's what I'd add. Nothing goes in until you say so.";
  if (cards.some((c) => c.type === "act")) return "Done. Changed your mind? Undo it below.";
  if (cards.some((c) => c.type === "memory" || c.type === "account")) return "Done.";
  return "That one didn't go through. Say it another way and I'll try again?";
}
