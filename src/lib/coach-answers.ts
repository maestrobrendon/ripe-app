// Knowledge the coach can answer from. Pure and client-safe, like the rest of
// the trained assistant's rule set. Never described as AI in customer copy.
//
// Every answer states something the app actually does, and money and shipping
// days are read from the same config the checkout uses, so an answer here
// cannot drift from the real behaviour.

import { formatNaira } from "@/lib/format";
import { BASE_DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";

export type CoachAnswer = {
  id: string;
  /** Lower-case phrases; the longest match wins, so keep specific ones long. */
  keywords: string[];
  answer: string;
  link?: { label: string; href: string };
};

const SHIP_DAYS = SHOPPING_WINDOW_DAYS.map((d) => d.label).join(", ");

export const COACH_ANSWERS: CoachAnswer[] = [
  {
    id: "areas",
    keywords: ["deliver to", "delivery area", "where do you deliver", "lekki", "ikoyi", "victoria island", "ikeja", "yaba", "surulere", "gbagada", "my area", "location", "zone"],
    answer:
      "We cover selected Lagos zones, including Lekki, Victoria Island, Ikoyi, Ikeja, Yaba, Surulere and Gbagada. Set your delivery area on any page to check whether we reach you.",
    link: { label: "See delivery areas", href: "/delivery-areas" },
  },
  {
    id: "delivery-cost",
    keywords: ["delivery fee", "delivery cost", "shipping cost", "how much is delivery", "free delivery", "cost of delivery"],
    answer: `Delivery is ${formatNaira(BASE_DELIVERY_FEE)}, and free once your cart passes ${formatNaira(
      FREE_DELIVERY_THRESHOLD,
    )}. Members get free delivery on their day.`,
    link: { label: "See subscriptions", href: "/subscribe" },
  },
  {
    id: "delivery-time",
    keywords: ["how long", "when will it arrive", "delivery time", "delivery day", "how quickly", "arrive", "same day", "when do you deliver", "delivery schedule", "what time"],
    answer:
      "Each zone has fixed delivery days with a 9am to 5pm window, and you choose the day that suits you at checkout.",
  },
  {
    id: "catalogue",
    keywords: ["what do you sell", "what do you have", "what do you stock", "fruit", "fruits", "vegetable", "vegetables", "veg", "produce", "catalogue", "in season"],
    answer:
      "We sell fruit and vegetables only, plus pre-picked boxes and pre-cut fresh cuts. If you are after something specific, search the shop or name it and I will check.",
    link: { label: "Browse the shop", href: "/shop" },
  },
  {
    id: "minimum",
    keywords: ["minimum order", "minimum", "how much do i have to spend", "order minimum"],
    answer:
      "There is no cart minimum. Each product is sold in a set pack size, greens by weight, oranges in pairs and so on, so you add only what you need.",
  },
  {
    id: "quality",
    keywords: ["not fresh", "bad produce", "spoiled", "rotten", "refund", "replace", "quality", "complaint", "damaged"],
    answer:
      "Every order is quality checked by a person before it leaves us. If something is not right, tell us within 24 hours and we will replace it or refund it.",
  },
  {
    id: "subscription",
    keywords: ["subscription", "subscribe", "membership", "member price", "member pricing", "monthly fee", "plan"],
    answer:
      "A subscription is optional and sits on top of a free account. It unlocks member pricing across the catalogue, free delivery on your set days, and a standing basket you edit week to week.",
    link: { label: "Compare subscriptions", href: "/subscribe" },
  },
  {
    id: "rewards",
    keywords: ["reward", "streak", "points", "level", "loyalty", "voucher", "credit", "badge"],
    answer:
      "A completed order each week builds a streak, and streaks unlock delivery credit, vouchers and early access to seasonal produce. Skipping a week does not break it. Your points and level in this panel come from your orders, streak and what is saved in your basket.",
    link: { label: "See your account", href: "/account" },
  },
  {
    id: "charging",
    keywords: ["charged", "auto charge", "automatic payment", "when do i pay", "do you charge", "billing", "charge me"],
    answer:
      "Nothing is ever charged automatically. Your basket stays saved and editable, and checking out yourself is the only thing that places an order and takes payment.",
  },
  {
    id: "ship-day",
    keywords: ["shopping window", "ship day", "which day", "thursday", "friday", "saturday", "shipping day"],
    answer: `A basket ships on the day you pick: ${SHIP_DAYS}. Picking a day only sets when it would go out. It starts no countdown and authorises no payment.`,
    link: { label: "Open my basket", href: "/basket" },
  },
  {
    id: "account",
    keywords: ["create an account", "sign up", "signup", "register", "get started", "how do i join"],
    answer:
      "Creating an account is free and takes a few questions about what you eat, so your first basket starts close to right. No card is needed.",
    link: { label: "Get started", href: "/start" },
  },
  {
    id: "how-it-works",
    keywords: ["how does it work", "how it works", "what is basket", "what do you do", "how do i order", "explain"],
    answer: `Build a basket from the shop, pick the day it ships (${SHIP_DAYS}), and it stays saved and editable until you check out. You can shop with no subscription at all.`,
    link: { label: "Browse the shop", href: "/shop" },
  },
  {
    id: "payment-methods",
    keywords: ["payment method", "card", "transfer", "pay with", "bank"],
    answer:
      "Card and bank transfer are both offered at checkout. Payment is in test mode for now, so no real money moves yet.",
  },
  {
    id: "human",
    keywords: ["speak to someone", "talk to a person", "human", "customer service", "support", "contact", "phone", "call you", "whatsapp"],
    answer: "A person on the Basket team can pick this up on WhatsApp.",
  },
];

const STOP_WORDS = new Set(["the", "a", "an", "is", "are", "do", "does", "i", "you", "my", "to", "of", "for", "and", "can", "it"]);

/**
 * Category words that must never drive a product lookup. Matching "fruit" would
 * answer "do you have dragon fruit" with "we stock Passion Fruit", which reads
 * as a yes to something we do not sell.
 */
const GENERIC_PRODUCE = new Set([
  "fruit",
  "fruits",
  "vegetable",
  "vegetables",
  "veg",
  "veggies",
  "produce",
  "box",
  "boxes",
  "basket",
  "baskets",
  "food",
  "groceries",
]);

export function normalizeQuery(raw: string): string {
  return ` ${raw.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/**
 * Longest-keyword-wins matching. Specific phrases ("delivery fee") therefore
 * beat loose single words ("delivery") when both are present.
 */
export function matchCoachAnswer(raw: string): CoachAnswer | null {
  const q = normalizeQuery(raw);
  if (q.trim().length < 2) return null;

  let best: { answer: CoachAnswer; score: number } | null = null;
  for (const answer of COACH_ANSWERS) {
    let score = 0;
    for (const keyword of answer.keywords) {
      if (q.includes(` ${keyword} `) || q.includes(`${keyword} `) || q.includes(` ${keyword}`)) {
        score = Math.max(score, keyword.length);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { answer, score };
  }
  return best?.answer ?? null;
}

/** Search terms worth sending to the catalogue, with filler words removed. */
export function productSearchTerms(raw: string): string[] {
  return normalizeQuery(raw)
    .trim()
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !GENERIC_PRODUCE.has(w))
    .slice(0, 4);
}

/**
 * Candidate singular/plural spellings of a word. The catalogue is singular
 * ("Mango"), but people type plurals ("mangoes"), and a plain substring match
 * misses that in the direction that matters.
 */
export function wordForms(word: string): string[] {
  const forms = new Set([word]);
  if (word.endsWith("ies")) forms.add(`${word.slice(0, -3)}y`);
  if (word.endsWith("es")) forms.add(word.slice(0, -2));
  if (word.endsWith("s")) forms.add(word.slice(0, -1));
  return [...forms].filter((w) => w.length >= 3);
}

/**
 * True only when a whole word of the product name matches a whole search term.
 * Substring matching is too eager here: "work" in "how do rewards work" would
 * otherwise pull in "Post-Workout Recovery Box" and bury the real answer.
 */
export function isStrongProductMatch(productName: string, terms: string[]): boolean {
  const queryForms = new Set(terms.flatMap(wordForms));
  const nameTokens = normalizeQuery(productName).trim().split(" ").filter(Boolean);
  return nameTokens.some((token) => wordForms(token).some((form) => queryForms.has(form)));
}
