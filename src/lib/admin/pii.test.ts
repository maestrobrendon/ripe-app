import { describe, expect, it } from "vitest";
import { maskAddress, maskEmail, maskPhone } from "./pii";

describe("contact masking", () => {
  it("keeps only enough to recognise a customer on the phone", () => {
    expect(maskEmail("ada.obi@gmail.com")).toBe("a•••i@gmail.com");
    expect(maskEmail("ab@x.ng")).toBe("a•••@x.ng");
    expect(maskEmail(null)).toBe("—");
    expect(maskPhone("+234 803 123 4567")).toBe("•••• 4567");
    expect(maskPhone("12")).toBe("••••");
    expect(maskAddress("12 Admiralty Way, Lekki Phase 1")).toBe("•••, Lekki Phase 1");
    expect(maskAddress("Somewhere")).toBe("•••");
  });

  it("never leaks the full value", () => {
    for (const e of ["someone.private@example.com", "x@y.z"]) expect(maskEmail(e)).not.toContain(e.split("@")[0].slice(1, -1) || "\u0000");
    expect(maskPhone("+2348031234567")).not.toContain("803");
  });
});
