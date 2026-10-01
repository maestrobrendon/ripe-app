import type { PlanLine } from "@/lib/produce-planner";
import type { ProduceColor } from "@/generated/prisma/enums";

const ALL_COLORS: ProduceColor[] = ["RED", "ORANGE", "YELLOW", "GREEN", "PURPLE", "WHITE_BROWN"];
export const COLOR_LABEL: Record<ProduceColor, string> = {
  RED: "Red",
  ORANGE: "Orange",
  YELLOW: "Yellow",
  GREEN: "Green",
  PURPLE: "Purple",
  WHITE_BROWN: "White/brown",
};

/**
 * Deterministic, not model-written (Recipes-by-tier addendum addition,
 * Produce Planner section): whether a customer eats an item raw or cooks it.
 * Driven by category, with a short override list for staples that are almost
 * never eaten raw. This is a coarse heuristic, not nutrition guidance — it's
 * there to group a shopping list, not to advise on diet.
 */
export type PrepGroup = "raw" | "cooked" | "either";

const COOKED_ONLY_SLUGS = new Set(["plantain", "sweet-potato", "yam", "potato", "corn", "garden-egg", "stir-fry-veg-mix", "coleslaw-mix"]);

export function classifyPrep(line: Pick<PlanLine, "slug" | "category">): PrepGroup {
  if (COOKED_ONLY_SLUGS.has(line.slug)) return "cooked";
  return line.category === "FRUIT" ? "raw" : "either";
}

export const PREP_GROUP_LABEL: Record<PrepGroup, string> = {
  raw: "Eat raw",
  cooked: "Cook",
  either: "Either",
};

export type VarietySummary = {
  groups: Record<PrepGroup, PlanLine[]>;
  /**
   * Grams per person per day, informational only, against the commonly cited
   * 400g daily guideline. Only counts lines that actually carry weight data
   * (soldAs WEIGHT with a referenceWeightG); a plan built entirely from
   * piece-sold items (a pineapple, a bunch of bananas) has no weight to sum,
   * so this comes back null rather than a guessed number — see the
   * addendum: "If weight data is missing for an item, skip the stat".
   */
  gramsPerPersonPerDay: number | null;
  countedTowardGrams: number;
  totalLines: number;
  /** Distinct colours present among items that carry one — mixes and bundles
   * have no single colour and simply don't count either way. */
  colorsCovered: ProduceColor[];
  colorsTotal: number;
};

export function buildVarietySummary(lines: PlanLine[], servings: number): VarietySummary {
  const groups: Record<PrepGroup, PlanLine[]> = { raw: [], cooked: [], either: [] };
  for (const line of lines) {
    groups[classifyPrep(line)].push(line);
  }

  const weighted = lines.filter((l) => l.soldAs === "WEIGHT" && l.referenceWeightG != null);
  let gramsPerPersonPerDay: number | null = null;
  if (weighted.length > 0 && servings > 0) {
    const totalGrams = weighted.reduce((sum, l) => sum + l.quantity * (l.referenceWeightG ?? 0), 0);
    gramsPerPersonPerDay = Math.round(totalGrams / servings / 7);
  }

  const colorsCovered = ALL_COLORS.filter((c) => lines.some((l) => l.color === c));

  return {
    groups,
    gramsPerPersonPerDay,
    countedTowardGrams: weighted.length,
    totalLines: lines.length,
    colorsCovered,
    colorsTotal: ALL_COLORS.length,
  };
}
