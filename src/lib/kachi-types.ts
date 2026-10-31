// Pure types and helpers, safe to import from client components. The
// Prisma-backed side of Kachi lives in src/lib/kachi.ts (server-only).
import type { OrderStatus } from "@/generated/prisma/enums";

/** Where Kachi is allowed to act. "chat" means nothing can change. */
export type KachiMode = { kind: "chat" } | { kind: "basket"; basketId: string } | { kind: "cart" };

export type KachiScope = { kind: "basket"; basketId: string; name: string } | { kind: "cart"; name: string };

export type KachiChange = { productId: string; name: string; before: number; after: number };

export type KachiListItem = {
  productId: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
};

export type KachiOrder = { id: string; status: OrderStatus; deliveryDate: string };

/** Something Kachi remembers about the customer. Kinds match KachiMemoryKind in the schema. */
export type KachiMemoryNote = { id: string; kind: "ALLERGY" | "DISLIKE" | "LIKE" | "HOUSEHOLD" | "ROUTINE" | "OTHER"; text: string };

/** A recipe from the library, with how much of it Basket can supply. */
export type KachiRecipe = { slug: string; title: string; summary: string; fromBasket: number };

export type KachiCard =
  | { type: "act"; scope: KachiScope; changes: KachiChange[] }
  | { type: "list"; scope: KachiScope; items: KachiListItem[] }
  | { type: "ask"; request: string }
  | { type: "order"; order: KachiOrder }
  | { type: "recipes"; recipes: KachiRecipe[] }
  | { type: "memory"; action: "remembered" | "forgot"; memory: KachiMemoryNote };

export type KachiReply = {
  reply: string;
  threadId?: string;
  title?: string;
  cards?: KachiCard[];
  /** Short replies the customer can tap next (Kachi's own suggestions, or the answers to her question). */
  suggestions?: string[];
  error?: string;
  /** The turn failed (busy or broken) and sending it again may work. */
  retry?: boolean;
};

/** Display names for a customer's baskets, oldest first: the goal tag if set, else a number when there are several. */
export function basketDisplayNames(baskets: { id: string; goalTag: string | null }[]): Map<string, string> {
  return new Map(
    baskets.map((b, i) => [b.id, b.goalTag || (baskets.length > 1 ? `Basket ${i + 1}` : "Your basket")]),
  );
}
