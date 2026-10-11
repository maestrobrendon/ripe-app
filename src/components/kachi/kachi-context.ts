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
export const KACHI_HIDDEN = [/^\/start/, /^\/welcome/, /^\/assistant/, /^\/checkout/, /^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/onboarding/];

export function kachiContext(pathname: string, signedIn: boolean, pageTitle: string): KachiContext {
  if (pathname === "/") {
    return {
      key: "home",
      greeting: "Hi, I'm Kachi. I plan meals around what you're working toward. What would you like to eat more of, or less of?",
      starters: ["Which goal fits me?", "What does a week cost?", "Do you deliver to me?"],
      nudge: { text: "Not sure where to start? Tell me your goal and I'll pick three recipes for you.", chips: ["I want to eat lighter", "Dinners for my family"] },
    };
  }
  const recipe = pathname.match(/^\/recipes\/([^/]+)$/);
  if (recipe) {
    const dish = pageTitle || "recipe";
    return {
      key: "recipe",
      greeting: `Cooking the ${dish}? I can scale it, suggest a swap, or tell you what the produce costs.`,
      starters: ["Make it for 4", "Swap an ingredient", "What goes well with it?"],
      nudge: { text: `Cooking the ${dish}? I can scale it for more people or swap anything you don't have.`, chips: ["Make it for 4", "Swap an ingredient"] },
    };
  }
  if (pathname.startsWith("/recipes")) {
    return {
      key: "recipes",
      greeting: "Hi, I'm Kachi. Tell me how much time you have, or what's in your kitchen, and I'll find a recipe.",
      starters: ["Something under 20 minutes", "High protein dinner", "I have plantain and eggs"],
      nudge: { text: "Looking for something quick? I can find a recipe that fits your evening.", chips: ["Under 20 minutes", "High protein"] },
    };
  }
  if (pathname.startsWith("/shop") || pathname.startsWith("/products")) {
    return {
      key: "shop",
      greeting: "Tell me what you're cooking this week and I'll tell you exactly what to get, and what it costs.",
      starters: ["What's in season?", "What do I need for jollof?", "Is membership worth it for me?"],
      nudge: { text: "Shopping for something in particular? Tell me the dish and I'll list what to get.", chips: ["What's in season?", "Plan a week of dinners"] },
    };
  }
  if (pathname.startsWith("/subscribe")) {
    return {
      key: "pricing",
      greeting: "Happy to help you pick. How many people do you cook for, and how often?",
      starters: ["Which plan suits me?", "How much is delivery?", "Can I pay as I go?"],
      nudge: { text: "Not sure which plan? Tell me how you cook and I'll work out what makes sense.", chips: ["Which plan suits me?", "How much is delivery?"] },
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
      greeting: "Anything you'd like to check before you order? I can suggest what goes with what you've picked.",
      starters: ["What can I cook with this?", "How much is delivery?"],
      nudge: null,
    };
  }
  return {
    key: "other",
    greeting: signedIn
      ? "Hi, it's Kachi. What are you cooking this week?"
      : "Hi, I'm Kachi. Ask me about recipes, produce, prices or delivery.",
    starters: ["Plan my week", "What's in season?", "How does Basket work?"],
    nudge: null,
  };
}
