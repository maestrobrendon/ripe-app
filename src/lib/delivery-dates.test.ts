import { describe, expect, it } from "vitest";
import { cutoffFor, lagosDate, nextDeliveryDate, parseYmd, ymd } from "./delivery-dates";
import { hasFreeDelivery, quoteDelivery } from "./pricing";

// 2026-10-12 is a Monday.
const at = (iso: string) => new Date(iso);

describe("delivery dates", () => {
  it("uses the Lagos calendar day, not the server's", () => {
    // 23:30 UTC Sunday is 00:30 Monday in Lagos.
    expect(ymd(lagosDate(at("2026-10-11T23:30:00Z")))).toBe("2026-10-12");
    expect(ymd(lagosDate(at("2026-10-11T22:30:00Z")))).toBe("2026-10-11");
  });

  it("closes orders at the cutoff hour, Lagos time, the day before", () => {
    // Wednesday 14 Oct; 18:00 Lagos on Tuesday 13 Oct is 17:00 UTC.
    expect(cutoffFor(parseYmd("2026-10-14")!, 18).toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });

  it("offers the next day whose cutoff hasn't passed", () => {
    // Monday morning: Wednesday is still open.
    expect(ymd(nextDeliveryDate("WEDNESDAY", 18, at("2026-10-12T08:00:00Z")))).toBe("2026-10-14");
    // Tuesday 17:59 Lagos: still open. 18:00 Lagos: closed, so the next Wednesday.
    expect(ymd(nextDeliveryDate("WEDNESDAY", 18, at("2026-10-13T16:59:00Z")))).toBe("2026-10-14");
    expect(ymd(nextDeliveryDate("WEDNESDAY", 18, at("2026-10-13T17:00:00Z")))).toBe("2026-10-21");
    // On the delivery day itself, the next one is a week away.
    expect(ymd(nextDeliveryDate("MONDAY", 18, at("2026-10-12T08:00:00Z")))).toBe("2026-10-19");
  });

  it("rejects malformed dates", () => {
    expect(parseYmd("2026-13-40")).toBeNull();
    expect(parseYmd("tomorrow")).toBeNull();
  });
});

describe("delivery fee", () => {
  it("charges the area's fee below the threshold, free on Member Plus", () => {
    expect(quoteDelivery(10_000, false, 3500).fee).toBe(3500);
    expect(quoteDelivery(10_000, hasFreeDelivery("premium"), 3500).fee).toBe(0);
    expect(quoteDelivery(10_000, hasFreeDelivery("base"), 3500).fee).toBe(3500);
    expect(quoteDelivery(30_000, false, 3500).fee).toBe(0);
  });
});
