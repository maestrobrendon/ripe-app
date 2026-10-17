import { describe, expect, it } from "vitest";
import { toMenuDetail, toMenuRecipe } from "./menu";
import { SETTING_SCHEMAS } from "./site-settings-schema";
import type { Recipe } from "@/generated/prisma/client";

const row = (over: Partial<Recipe>): Recipe =>
  ({
    id: "r1", slug: "bowl", title: "Bowl", summary: "Good.", goalTags: [], ingredientProductIds: [], instructions: "", isAssistantGenerated: false,
    goal: "lighter", minutes: 20, serves: 2, image: "/images/menu/bowl.jpg", imageAlt: null, basketSlugs: ["tomato"], elsewhere: ["Rice"], steps: ["Cook."],
    amounts: null, tools: [], onMenu: true, membersOnly: false, status: "PUBLISHED", sortOrder: 10, version: 0, updatedAt: new Date(), createdAt: new Date(),
    ...over,
  }) as Recipe;

describe("menu rows", () => {
  it("reads well-formed amounts and ignores anything else", () => {
    const d = toMenuDetail(row({ amounts: { tomato: [2, ""], Rice: [150, "g"], bad: "two", worse: [1] } as never, tools: ["Pan"] }));
    expect(d.amounts).toEqual({ tomato: [2, ""], Rice: [150, "g"] });
    expect(d.tools).toEqual(["Pan"]);
  });

  it("falls back for an unknown goal and uses the title as alt text", () => {
    const m = toMenuRecipe(row({ goal: "nonsense", imageAlt: null }));
    expect(m.goal).toBe("busy");
    expect(m.alt).toBe("Bowl");
    expect(m.basket).toEqual(["tomato"]);
  });
});

describe("site settings", () => {
  it("accepts a real support line and rejects junk", () => {
    expect(SETTING_SCHEMAS.support.safeParse({ whatsapp: "2348031234567", email: "Hello@Basket.ng" }).success).toBe(true);
    expect(SETTING_SCHEMAS.support.safeParse({ whatsapp: "+234 803", email: "hello@basket.ng" }).success).toBe(false);
    expect(SETTING_SCHEMAS.support.safeParse({ whatsapp: "2348031234567", email: "not an email" }).success).toBe(false);
  });
  it("keeps the free-delivery threshold a sane whole number", () => {
    expect(SETTING_SCHEMAS.delivery.safeParse({ freeThreshold: 25000 }).success).toBe(true);
    expect(SETTING_SCHEMAS.delivery.safeParse({ freeThreshold: -1 }).success).toBe(false);
    expect(SETTING_SCHEMAS.delivery.safeParse({ freeThreshold: 99.5 }).success).toBe(false);
  });
});
