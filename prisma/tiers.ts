// Two plans. Slugs stay "base" and "premium": code keys on "premium" (see
// hasEarlySeasonalAccess in src/lib/streak-config.ts). The old "mid" plan was
// folded in; prisma/scripts/two-tiers.ts moved its members to "base".
export const tiers = [
  {
    slug: "base",
    name: "Member",
    monthlyFee: 4500,
    tagline: "Every recipe, member prices and a basket that plans itself.",
    sortOrder: 1,
    perks: [
      "Every recipe on the menu",
      "Member prices on everything, about a quarter less",
      "A standing weekly basket: change it until the night before, skip any week",
      "A weekly meal plan built from the recipe menu",
      "Recipes add only what your basket is missing, in one tap",
      "More than one basket, for different days or goals",
    ],
  },
  {
    slug: "premium",
    name: "Member Plus",
    monthlyFee: 8500,
    tagline: "Everything in Member, plus free delivery, first pick of the season and faster help.",
    sortOrder: 2,
    perks: [
      "Everything in Member",
      "Free delivery on every basket",
      "Early access to seasonal produce, like agbalumo and mango season",
      "Priority support on WhatsApp",
    ],
  },
];
