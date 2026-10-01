// The recipes conversation's rule set. Pure functions, no model calls: this is
// a scoped, deterministic assistant over the produce planner, not a general
// chatbot. Never described as AI in customer copy — see [ASSISTANT_LABEL]
// wherever a display name for it is needed in the UI.

import type { Product } from "@/generated/prisma/client";
import { planFromText, type PlanResponse } from "./produce-planner";

export type AssistantReply =
  | { type: "clarify"; question: string }
  | { type: "plan"; intro: string; response: PlanResponse }
  | { type: "fallback"; message: string };

const SERVINGS_PATTERN =
  /\bfor\s+(\d{1,2})\b|\b(\d{1,2})\s*(?:people|persons?|pax|servings?|plates?)\b/;

const WORD_SERVINGS: Record<string, number> = {
  me: 1,
  myself: 1,
  one: 1,
  single: 1,
  two: 2,
  both: 2,
  couple: 2,
  us: 2,
  partner: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  family: 4,
  everyone: 4,
  household: 4,
};

export function parseServingsFromMessage(text: string): number | null {
  const t = text.toLowerCase();
  const m = t.match(SERVINGS_PATTERN);
  if (m) {
    const n = Number(m[1] ?? m[2]);
    if (n >= 1 && n <= 20) return n;
  }
  for (const [word, n] of Object.entries(WORD_SERVINGS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n;
  }
  return null;
}

/**
 * A loose scope guard, not a security boundary: most real messages here are
 * short ingredient names or themes ("mango", "lighter dinners") that mention
 * no food word at all, so length alone is usually enough. It only exists to
 * steer clearly off-topic, long-form messages away from a food answer.
 */
const SCOPE_WORDS = [
  "cook",
  "cooking",
  "recipe",
  "recipes",
  "eat",
  "eating",
  "meal",
  "meals",
  "dinner",
  "lunch",
  "breakfast",
  "snack",
  "produce",
  "fruit",
  "veg",
  "vegetable",
  "salad",
  "soup",
  "smoothie",
  "juice",
  "blend",
  "roast",
  "saute",
  "kitchen",
  "food",
];

function looksFoodRelated(text: string): boolean {
  const t = text.toLowerCase();
  return t.length < 60 || SCOPE_WORDS.some((w) => t.includes(w));
}

export function respondToMessage(
  message: string,
  knownServings: number | null,
  products: Product[],
): AssistantReply {
  const text = message.trim();
  if (!text) {
    return {
      type: "fallback",
      message: "Tell me what you have, or what you're cooking for, and I'll build a produce list.",
    };
  }

  if (!looksFoodRelated(text)) {
    return {
      type: "fallback",
      message:
        "I can only help with recipes and produce here. Try naming something you have, or what you're eating for.",
    };
  }

  const messageServings = parseServingsFromMessage(text);
  const servings = messageServings ?? knownServings;

  if (servings === null) {
    return { type: "clarify", question: "How many people are you cooking for?" };
  }

  // planFromText parses its own servings out of the string, defaulting to 3
  // when none is found, so a message that already carries a number is passed
  // through untouched and one resolved from an earlier turn is appended.
  const withServings = messageServings !== null ? text : `${text} for ${servings}`;
  const response = planFromText(withServings, products);

  if ("plan" in response && response.plan === null) {
    return {
      type: "fallback",
      message:
        'I couldn\'t turn that into a produce plan. Try naming a fruit or vegetable you have, or ask for something like "light dinners" or "meal prep".',
    };
  }

  return { type: "plan", intro: "Here's an idea, built from what we stock:", response };
}
