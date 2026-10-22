import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orderCount: 0,
  orders: [] as { id: string; deliveryDate: Date; status: string }[],
  skips: [] as { opensAt: Date }[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      count: async () => db.orderCount,
      findMany: async () => db.orders,
    },
    shoppingWindow: { findMany: async () => db.skips },
  },
}));
vi.mock("@/lib/order-container", () => ({ isMember: (u: { subscriptionTierId: string | null }) => Boolean(u.subscriptionTierId) }));

import { basketCycle, confirmRight, cycleStart } from "./basket-rules";

const d = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const zone = { cutoffHour: 18 };

beforeEach(() => {
  db.orderCount = 0;
  db.orders = [];
  db.skips = [];
});

describe("who can confirm a basket", () => {
  it("lets members confirm, every week", async () => {
    expect(await confirmRight({ id: "u", subscriptionTierId: "tier" })).toEqual({ ok: true, trial: false });
  });

  it("gives a free account one trial basket", async () => {
    expect(await confirmRight({ id: "u", subscriptionTierId: null })).toEqual({ ok: true, trial: true });
  });

  it("asks a free account to join once its trial has been used", async () => {
    db.orderCount = 1;
    expect(await confirmRight({ id: "u", subscriptionTierId: null })).toEqual({ ok: false, reason: "trial-used" });
  });
});

describe("4-week cycles", () => {
  it("starts on the membership day and rolls every 28 days (Lagos calendar)", () => {
    expect(cycleStart(d("2026-10-01"), new Date("2026-10-18T09:00:00Z"))).toEqual(d("2026-10-01"));
    expect(cycleStart(d("2026-10-01"), new Date("2026-10-29T09:00:00Z"))).toEqual(d("2026-10-29"));
    // 23:30 UTC on the 28th is already the 29th in Lagos.
    expect(cycleStart(d("2026-10-01"), new Date("2026-10-28T23:30:00Z"))).toEqual(d("2026-10-29"));
  });

  it("marks each week: delivered, to confirm, skipped, then coming", async () => {
    db.orders = [{ id: "o1", deliveryDate: d("2026-10-17"), status: "DELIVERED" }];
    db.skips = [{ opensAt: d("2026-10-31") }];
    const c = await basketCycle({ id: "b", createdAt: d("2026-10-01") }, "SATURDAY", zone, d("2026-10-11"), new Date("2026-10-18T09:00:00Z"));
    expect(c.weeks.map((w) => [w.dateIso.slice(0, 10), w.state])).toEqual([
      ["2026-10-17", "delivered"],
      ["2026-10-24", "to-confirm"],
      ["2026-10-31", "skipped"],
      ["2026-11-07", "upcoming"],
    ]);
    expect(c.weeks[0].orderId).toBe("o1");
    expect(c.weekNumber).toBe(2);
  });

  it("says a week was missed only if the basket existed before it closed", async () => {
    const now = new Date("2026-10-18T09:00:00Z");
    const old = await basketCycle({ id: "b", createdAt: d("2026-10-01") }, "SATURDAY", zone, d("2026-10-11"), now);
    expect(old.weeks[0].state).toBe("missed");
    const fresh = await basketCycle({ id: "b", createdAt: new Date("2026-10-17T10:00:00Z") }, "SATURDAY", zone, d("2026-10-11"), now);
    expect(fresh.weeks[0].state).toBe("before");
  });

  it("shows confirmed and on-the-way weeks from their orders", async () => {
    db.orders = [
      { id: "a", deliveryDate: d("2026-10-24"), status: "RECEIVED" },
      { id: "b", deliveryDate: d("2026-10-31"), status: "OUT_FOR_DELIVERY" },
    ];
    const c = await basketCycle({ id: "b", createdAt: d("2026-10-01") }, "SATURDAY", zone, d("2026-10-11"), new Date("2026-10-18T09:00:00Z"));
    expect(c.weeks.slice(1, 3).map((w) => w.state)).toEqual(["confirmed", "on-the-way"]);
    // The first open week after those is the one to confirm.
    expect(c.weeks[3].state).toBe("to-confirm");
  });

  it("never shows week 0, even with a start date in the future", async () => {
    const c = await basketCycle({ id: "b", createdAt: d("2026-10-01") }, "SATURDAY", zone, d("2026-11-01"), new Date("2026-10-18T09:00:00Z"));
    expect(c.weekNumber).toBe(1);
  });

  it("falls back to when the basket was made if there's no membership date", async () => {
    const c = await basketCycle({ id: "b", createdAt: d("2026-10-11") }, "FRIDAY", zone, null, new Date("2026-10-18T09:00:00Z"));
    expect(c.start).toEqual(d("2026-10-11"));
    expect(c.weeks[0].dateIso.slice(0, 10)).toBe("2026-10-16");
  });
});
