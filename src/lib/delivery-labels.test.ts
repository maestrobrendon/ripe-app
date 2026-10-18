import { describe, expect, it } from "vitest";
import { basketLabels, basketName, orderPhrase } from "./delivery-labels";

const b = (id: string, name: string | null, deliveryDay: "THURSDAY" | "SATURDAY", oneOff = false) => ({ id, name, deliveryDay, oneOff });

describe("what baskets are called", () => {
  it("keeps names, and calls a single unnamed basket My basket", () => {
    const l = basketLabels([b("a", null, "THURSDAY"), b("b", "For Mum", "SATURDAY")]);
    expect(l.get("a")).toBe("My basket");
    expect(l.get("b")).toBe("For Mum");
  });

  it("tells several unnamed baskets apart by day, numbering two on the same day", () => {
    const l = basketLabels([b("a", null, "THURSDAY"), b("b", null, "SATURDAY"), b("c", null, "SATURDAY")]);
    expect([l.get("a"), l.get("b"), l.get("c")]).toEqual(["Thursday basket", "Saturday basket", "Saturday basket 2"]);
  });

  it("always calls a one-time order that, and doesn't count it as an unnamed basket", () => {
    const l = basketLabels([b("a", null, "THURSDAY"), b("o", null, "SATURDAY", true)]);
    expect(l.get("a")).toBe("My basket");
    expect(l.get("o")).toBe("One-time order");
    expect(basketName({ name: "ignored", oneOff: true })).toBe("One-time order");
    expect(orderPhrase({ name: null, oneOff: true })).toBe("your one-time order");
  });
});
