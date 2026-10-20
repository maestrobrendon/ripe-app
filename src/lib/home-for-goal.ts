import type { MenuGoal } from "@/lib/menu-types";
import type { ProductCategory } from "@/generated/prisma/enums";

/*
 * Home arranged around what the customer is after: which section leads, what
 * it's called, and what fills it. The goal is the basket's own if it has one
 * (a "For Mum" basket can be about family), else the one they picked at
 * sign-up.
 */

export type HomeSection = "cook" | "usuals" | "season";

export type HomeLayout = {
  order: HomeSection[];
  cook: { title: string; subtitle: string };
  season: { title: string; subtitle: string; category?: ProductCategory };
  /** Only recipes this quick, when there are enough of them. */
  maxMinutes?: number;
};

const COOK = { title: "Cook this week", subtitle: "Recipes that use what's already in your basket." };
const SEASON = { title: "Good this week", subtitle: "In stock and at its best right now." };

const LAYOUTS: Record<MenuGoal, HomeLayout> = {
  fruit: {
    order: ["season", "usuals", "cook"],
    season: { title: "Fruit at its best", subtitle: "Ripe this week, picked for you.", category: "FRUIT" },
    cook: { title: "Ways to enjoy it", subtitle: "Simple, exciting ideas for good fruit." },
  },
  busy: {
    order: ["cook", "usuals", "season"],
    cook: { title: "Quick this week", subtitle: "Twenty minutes or less, from what you've got." },
    season: SEASON,
    maxMinutes: 20,
  },
  plants: {
    order: ["season", "cook", "usuals"],
    season: { title: "Vegetables at their best", subtitle: "Fresh this week, ready for more plants on your plate.", category: "VEGETABLE" },
    cook: { title: "More plants this week", subtitle: "Recipes where the vegetables are the star." },
  },
  lighter: {
    order: ["cook", "season", "usuals"],
    cook: { title: "Light and fresh", subtitle: "Crisp, bright recipes for this week." },
    season: SEASON,
  },
  family: {
    order: ["cook", "season", "usuals"],
    cook: { title: "Family plates", subtitle: "Recipes that feed everyone at the table." },
    season: SEASON,
  },
  training: {
    order: ["cook", "usuals", "season"],
    cook: { title: "Fresh fuel for training", subtitle: "Produce that works as hard as you do." },
    season: SEASON,
  },
};

const DEFAULT: HomeLayout = { order: ["cook", "usuals", "season"], cook: COOK, season: SEASON };

export const homeFor = (goal: MenuGoal | null): HomeLayout => (goal ? LAYOUTS[goal] : DEFAULT);
