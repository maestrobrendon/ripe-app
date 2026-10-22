import { describe, expect, it } from "vitest";
import { homeFor } from "./home-for-goal";

describe("Home arranged around the goal", () => {
  it("leads with fruit for fruit people, and vegetables for more plants", () => {
    expect(homeFor("fruit").order[0]).toBe("season");
    expect(homeFor("fruit").season.category).toBe("FRUIT");
    expect(homeFor("plants").season.category).toBe("VEGETABLE");
  });

  it("keeps busy weeks to quick recipes", () => {
    expect(homeFor("busy").maxMinutes).toBe(20);
    expect(homeFor("busy").cook.title).toBe("Quick this week");
  });

  it("falls back to the usual Home with no goal, and always shows all three sections", () => {
    expect(homeFor(null).cook.title).toBe("Cook this week");
    for (const g of [null, "fruit", "busy", "plants", "lighter", "family", "training"] as const) {
      expect([...homeFor(g).order].sort()).toEqual(["cook", "season", "usuals"]);
    }
  });
});
