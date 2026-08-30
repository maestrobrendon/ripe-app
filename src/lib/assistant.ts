// The trained assistant's rule set. Pure functions so both server pages and the
// client Recipes panel can use them. Never described as AI in customer copy.

export type Goal = {
  slug: string;
  label: string;
  description: string;
};

export const GOALS: Goal[] = [
  {
    slug: "post-workout-recovery",
    label: "Post-workout recovery",
    description: "Produce that people usually reach for after training.",
  },
  {
    slug: "family-household",
    label: "Family and household eating",
    description: "Produce that works for a table of different ages and tastes.",
  },
  {
    slug: "general-wellness",
    label: "General wellness",
    description: "A steady spread of fruit and vegetables through the week.",
  },
  {
    slug: "weight-management",
    label: "Weight management",
    description: "Lower-calorie produce that is filling and easy to prep.",
  },
];

type PlanRecipe = {
  title: string;
  uses: string[];
  note: string;
};

type GoalPlan = {
  recipes: PlanRecipe[];
  addOns: string[];
};

const GOAL_PLANS: Record<string, GoalPlan> = {
  "post-workout-recovery": {
    recipes: [
      { title: "Banana and watermelon plate", uses: ["banana", "watermelon"], note: "People usually eat this cold, straight after training." },
      { title: "Sweet potato and spinach side", uses: ["sweet-potato", "spinach"], note: "Roasted sweet potato with wilted spinach, a common recovery plate." },
      { title: "Recovery box, as packed", uses: ["recovery-box"], note: "Banana, watermelon, sweet potato and spinach in one pack." },
    ],
    addOns: ["banana", "watermelon", "sweet-potato"],
  },
  "family-household": {
    recipes: [
      { title: "Fruit plate for the table", uses: ["pawpaw", "banana", "orange"], note: "A shared plate that covers different tastes." },
      { title: "Pineapple and avocado on the side", uses: ["pineapple", "avocado"], note: "Pairs well with eggs or bread." },
      { title: "Breakfast box, as packed", uses: ["breakfast-box"], note: "Pawpaw, banana, oranges and avocado, sized for a family." },
    ],
    addOns: ["pawpaw", "banana", "avocado"],
  },
  "general-wellness": {
    recipes: [
      { title: "Soup pot vegetables", uses: ["ugu", "spinach", "tomato", "bell-pepper", "onion"], note: "What people usually put in a pot of soup during the week." },
      { title: "Mixed fruit through the week", uses: ["apple", "orange", "banana"], note: "Spread across a few days rather than eaten in one sitting." },
      { title: "Soup box, as packed", uses: ["soup-box"], note: "Ugu, spinach, tomato, pepper and onion in one pack." },
    ],
    addOns: ["ugu", "spinach", "orange"],
  },
  "weight-management": {
    recipes: [
      { title: "Cucumber and tomato side", uses: ["cucumber", "tomato"], note: "Low prep, usually eaten raw as a side." },
      { title: "Watermelon in place of dessert", uses: ["watermelon"], note: "What people usually swap in when cutting down on sweet snacks." },
      { title: "Cabbage and carrot slaw", uses: ["cabbage", "carrot"], note: "Shredded raw, dressed lightly." },
    ],
    addOns: ["cucumber", "cabbage", "carrot"],
  },
};

const PAIRINGS: Record<string, string[]> = {
  ugu: ["tomato", "bell-pepper", "spinach"],
  spinach: ["tomato", "sweet-potato"],
  tomato: ["bell-pepper", "onion", "ugu"],
  pawpaw: ["banana", "orange"],
  pineapple: ["banana", "ginger"],
  banana: ["watermelon", "pawpaw"],
  cucumber: ["tomato", "carrot"],
  avocado: ["tomato", "cucumber"],
};

export type AssistantContext = {
  /** Slugs the customer has flagged as favorites in onboarding. */
  favorites?: string[];
  /** Free-text dietary notes, used to drop obvious mismatches from add-ons. */
  dietaryNotes?: string;
  householdSize?: number;
};

function filterByDiet(slugs: string[], dietaryNotes?: string): string[] {
  if (!dietaryNotes) return slugs;
  const notes = dietaryNotes.toLowerCase();
  return slugs.filter((slug) => !notes.includes(slug.replace(/-/g, " ")));
}

export function getGoalSuggestions(goalSlug: string, ctx: AssistantContext = {}): GoalPlan | null {
  const plan = GOAL_PLANS[goalSlug];
  if (!plan) return null;

  const favouriteFirst = [
    ...(ctx.favorites ?? []).filter((f) => !plan.addOns.includes(f)),
    ...plan.addOns,
  ];

  return {
    recipes: plan.recipes,
    addOns: filterByDiet(favouriteFirst, ctx.dietaryNotes).slice(0, 5),
  };
}

export function getBasketSuggestions(
  cartSlugs: string[],
  ctx: AssistantContext = {},
): { pairings: { forProduct: string; suggest: string[] }[]; addOns: string[] } {
  const inCart = new Set(cartSlugs);
  const pairings: { forProduct: string; suggest: string[] }[] = [];
  const addOns = new Set<string>();

  for (const slug of cartSlugs) {
    const pairs = PAIRINGS[slug];
    if (!pairs) continue;
    const missing = pairs.filter((p) => !inCart.has(p));
    if (missing.length) {
      pairings.push({ forProduct: slug, suggest: missing });
      missing.forEach((m) => addOns.add(m));
    }
  }

  (ctx.favorites ?? []).forEach((f) => {
    if (!inCart.has(f)) addOns.add(f);
  });

  return {
    pairings,
    addOns: filterByDiet(Array.from(addOns), ctx.dietaryNotes).slice(0, 5),
  };
}
