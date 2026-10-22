import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orderHeadline, paymentLine } from "./order-copy";

const order = (status: Parameters<typeof orderHeadline>[0]["status"], date: string) => ({
  status,
  deliveryDateIso: `${date}T00:00:00.000Z`,
  cutoffIso: `${date}T00:00:00.000Z`,
  canCancel: false,
  rider: null,
});

describe("how an order reads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Sunday 18 October, 10am in Lagos.
    vi.setSystemTime(new Date("2026-10-18T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("never says 'arriving' on a day that has gone", () => {
    for (const s of ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY"] as const) {
      const h = orderHeadline(order(s, "2026-10-12"));
      expect(h.title).toBe("Running late");
      expect(h.body).toContain("Monday 12 Oct");
    }
  });

  it("says today for an order on its way today", () => {
    expect(orderHeadline(order("OUT_FOR_DELIVERY", "2026-10-18")).body).toContain("today");
  });

  it("keeps the normal wording for a coming date", () => {
    expect(orderHeadline(order("CONFIRMED", "2026-10-24")).title).toBe("Confirmed for Saturday 24 Oct");
  });

  it("leaves finished orders alone, whatever their date", () => {
    expect(orderHeadline(order("DELIVERED", "2026-10-12")).title).toBe("Delivered");
    expect(orderHeadline(order("FAILED_DELIVERY", "2026-10-12")).title).toBe("We missed you");
    expect(orderHeadline(order("CANCELLED", "2026-10-12")).title).toBe("Cancelled");
  });
});

describe("how payment reads", () => {
  const naira = (n: number) => `N${n}`;
  it("asks for payment on arrival before delivery, and says what's due after", () => {
    expect(paymentLine({ paidAt: null, paymentMethod: "Pay on delivery", total: 7340, status: "RECEIVED" }, naira)).toBe("Pay N7340 when it arrives");
    expect(paymentLine({ paidAt: null, paymentMethod: "Pay on delivery", total: 7340, status: "DELIVERED" }, naira)).toBe("N7340 to pay · Pay on delivery");
    expect(paymentLine({ paidAt: new Date(), paymentMethod: "Pay on delivery", total: 7340, status: "DELIVERED" }, naira)).toBe("Paid · Pay on delivery");
  });
});
