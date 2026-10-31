import { describe, it, expect } from "vitest";
import { visibleSoFar } from "./use-kachi-conversation";

describe("what shows of a reply still being written", () => {
  it("names a recipe written as a bare marker", () => {
    expect(visibleSoFar("My pick is [[pawpaw-boats]], which uses pawpaw.")).toBe("My pick is Pawpaw boats, which uses pawpaw.");
  });
  it("drops a marker that sits beside its name", () => {
    expect(visibleSoFar("Try the Pawpaw Boats [[pawpaw-boats]] today.")).toBe("Try the Pawpaw Boats today.");
  });
  it("hides a half-written marker", () => {
    expect(visibleSoFar("Try the [[pawpaw-bo")).toBe("Try the");
  });
  it("hides the NEXT line of suggested replies, even half-written", () => {
    expect(visibleSoFar("Good choice.\nNEXT: a | b")).toBe("Good choice.");
    expect(visibleSoFar("Good choice.\nNE")).toBe("Good choice.");
  });
});
