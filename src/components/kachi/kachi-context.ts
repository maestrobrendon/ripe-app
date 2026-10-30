/**
 * What Kachi says first, page by page: the greeting when the bubble opens,
 * the starter questions under it, and the one nudge she may offer if
 * someone lingers. Kept as plain data so the voice is easy to tune without
 * touching the bubble's behaviour.
 *
 * `key` groups pages for the nudge rules: a nudge is offered at most once
 * per key per visit (all recipe pages share one).
 */

export type KachiContext = {
  key: string;
  greeting: string;
  starters: string[];
  nudge: { text: string; chips: string[] } | null;
};

/** Where the bubble stays out of the way: focused flows, and Kachi's own page. */
export const KACHI_HIDDEN = [/^\/start/, /^\/feedback/, /^\/gift/, /^\/welcome/, /^\/assistant/, /^\/checkout/, /^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/onboarding/];

export function kachiContext(pathname: string, signedIn: boolean, pageTitle: string): KachiContext {
  if (pathname === "/") {
    return {
      key: "home",
      greeting: "Hey, I'm Kachi. I help you eat more fruit and veg without it feeling like homework. What are you after: more energy, lighter meals, or just good fruit?",
      starters: ["Just good fruit, please", "What does a week cost?", "Do you deliver to me?"],
      nudge: { text: "Hey, I'm Kachi. Tell me what you're after and I'll put a first basket together for you.", chips: ["Just good fruit", "Feed the family"] },
    };
  }
  const recipe = pathname.match(/^\/recipes\/([^/]+)$/);
  if (recipe) {
    const dish = pageTitle || "recipe";
    return {
      key: "recipe",
      greeting: `Ooh, the ${dish}. Good taste. Want it for more people, a swap for something you don't have, or what the produce costs?`,
      starters: ["Make it for 4", "Swap an ingredient", "What goes well with it?"],
      nudge: { text: `Eyeing the ${dish}? I can scale it up or swap anything you don't have.`, chips: ["Make it for 4", "Swap an ingredient"] },
    };
  }
  if (pathname.startsWith("/recipes")) {
    return {
      key: "recipes",
      greeting: "Hey, I'm Kachi. How much time have you got, and what's already in your kitchen? I'll find you something worth eating.",
      starters: ["Something under 20 minutes", "A fresh salad idea", "I have mangoes and cucumber"],
      nudge: { text: "Short on time? I know a few recipes that are faster than delivery.", chips: ["Under 20 minutes", "A fresh salad"] },
    };
  }
  if (pathname.startsWith("/shop") || pathname.startsWith("/products")) {
    return {
      key: "shop",
      greeting: "Tell me what you're in the mood for this week and I'll tell you exactly what to get, and what it costs.",
      starters: ["What's in season?", "What can I make with mango?", "Is membership worth it for me?"],
      nudge: { text: "Not sure what's good right now? I know what's at its best this week.", chips: ["What's in season?", "Plan my fruit for the week"] },
    };
  }
  if (pathname.startsWith("/subscribe")) {
    return {
      key: "pricing",
      greeting: "Let's find the plan that actually fits you. How many people are eating, and how often do you want a basket?",
      starters: ["Which plan suits me?", "How much is delivery?", "Can I pay as I go?"],
      nudge: { text: "Weighing it up? Tell me how you eat and I'll do the maths for you.", chips: ["Which plan suits me?", "How much is delivery?"] },
    };
  }
  if (pathname.startsWith("/basket")) {
    return {
      key: "basket",
      greeting: "Want ideas for what's in your basket, or help filling it for the week?",
      starters: ["What can I cook with my basket?", "Am I missing anything for my recipes?", "Make it lighter"],
      nudge: signedIn ? { text: "I can turn what's in your basket into a few dinners. Want ideas?", chips: ["What can I cook?", "Am I missing anything?"] } : null,
    };
  }
  if (pathname.startsWith("/cart")) {
    return {
      key: "cart",
      greeting: "Nice picks. Want to know what goes with them, or check anything before you order?",
      starters: ["What can I cook with this?", "How much is delivery?"],
      nudge: null,
    };
  }
  return {
    key: "other",
    greeting: signedIn
      ? "Hey, it's Kachi. What are we eating this week?"
      : "Hey, I'm Kachi. Ask me anything about fruit, veg, recipes, prices or delivery.",
    starters: ["Plan my week", "What's in season?", "How does Basket work?"],
    nudge: null,
  };
}
