import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/order-container", () => ({ priceFor: (p: { memberPrice: number; standardPrice: number }, member: boolean) => (member ? p.memberPrice : p.standardPrice) }));

import { fitRecipe } from "./recipe-fit";
import type { MenuRecipe } from "./menu-types";

const recipe = { id: "r1", slug: "salad", title: "Salad", image: "/a.jpg", minutes: 10, basket: ["tomato", "cucumber", "mint", "feta"] } as MenuRecipe;
const buyable = new Map([
  ["tomato", { slug: "tomato", memberPrice: 800, standardPrice: 1000, minOrderQty: 1 }],
  ["cucumber", { slug: "cucumber", memberPrice: 400, standardPrice: 500, minOrderQty: 2 }],
  ["mint", { slug: "mint", memberPrice: 300, standardPrice: 350, minOrderQty: 1 }],
]);

describe("how close a basket is to a recipe", () => {
  it("counts what's in, and prices only what we can bring", () => {
    // feta isn't something we sell, so it's never "missing" from us.
    const f = fitRecipe(recipe, new Set(["tomato"]), buyable, false);
    expect(f).toMatchObject({ id: "r1", have: 1, total: 4, need: 2, needCost: 500 * 2 + 350 });
  });

  it("uses member prices for members", () => {
    expect(fitRecipe(recipe, new Set(["tomato"]), buyable, true).needCost).toBe(400 * 2 + 300);
  });

  it("needs nothing when everything we sell is in", () => {
    expect(fitRecipe(recipe, new Set(["tomato", "cucumber", "mint"]), buyable, false)).toMatchObject({ have: 3, need: 0, needCost: 0 });
  });

  it("copes with an empty basket", () => {
    expect(fitRecipe(recipe, new Set(), buyable, false)).toMatchObject({ have: 0, need: 3 });
  });
});
