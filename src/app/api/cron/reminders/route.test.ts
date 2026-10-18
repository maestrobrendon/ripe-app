import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  baskets: [] as unknown[],
  ordered: 0,
  cycle: { date: null as Date | null, cutoff: null as Date | null, day: "SATURDAY" },
  sent: [] as { kind: string; dedupeKey: string; email?: { subject: string }; whatsapp?: { text: string }; push?: { url: string } }[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    basket: { findMany: async () => s.baskets },
    order: { count: async () => s.ordered },
  },
}));
vi.mock("@/lib/notify", () => ({ notify: async (m: (typeof s.sent)[number]) => void s.sent.push(m) }));
vi.mock("@/lib/delivery", () => ({ zoneForUser: async () => ({ cutoffHour: 18 }), getDeliveryCycle: async () => s.cycle }));
vi.mock("@/lib/order-container", () => ({ priceFor: (p: { memberPrice: number }) => p.memberPrice }));

import { GET } from "./route";

const product = (name: string) => ({ name, tags: [] as string[], availability: "AVAILABLE", isActive: true, status: "PUBLISHED", memberPrice: 1000, standardPrice: 1200 });
const basket = { id: "bsk1", userId: "u1", name: "For Mum", items: [{ quantity: 2, product: product("Mango") }], user: { id: "u1", name: "Ada Obi", email: "ada@example.test", phone: "+2348000000000" } };
const req = (auth?: string) => new Request("http://localhost/api/cron/reminders", { headers: auth ? { authorization: auth } : {} });
// Lagos midnight of a date, as stored.
const d = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

beforeEach(() => {
  vi.useFakeTimers();
  s.baskets = [basket];
  s.ordered = 0;
  s.sent = [];
  delete process.env.CRON_SECRET;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("weekly basket reminders", () => {
  it("sends 'ready' three days before, on every channel, linking to checkout", async () => {
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z")); // Wed 21 Oct, 8am Lagos
    s.cycle = { date: d("2026-10-24"), cutoff: new Date("2026-10-23T17:00:00Z"), day: "SATURDAY" };
    const res = await (await GET(req())).json();
    expect(res).toMatchObject({ checked: 1, ready: 1, lastCall: 0 });
    const m = s.sent[0];
    expect(m.kind).toBe("reminder.ready");
    expect(m.dedupeKey).toBe("reminder:ready:bsk1:2026-10-24");
    expect(m.email?.subject).toContain("For Mum is ready");
    expect(m.whatsapp?.text).toContain("Mango");
    expect(m.whatsapp?.text).toContain("₦2,000");
    expect(m.push?.url).toBe("/checkout?b=bsk1");
  });

  it("sends a last call on the day it closes", async () => {
    vi.setSystemTime(new Date("2026-10-23T07:00:00Z")); // Fri 23 Oct, closes 6pm
    s.cycle = { date: d("2026-10-24"), cutoff: new Date("2026-10-23T17:00:00Z"), day: "SATURDAY" };
    const res = await (await GET(req())).json();
    expect(res).toMatchObject({ ready: 0, lastCall: 1 });
    expect(s.sent[0].kind).toBe("reminder.last-call");
  });

  it("stays quiet on other days", async () => {
    vi.setSystemTime(new Date("2026-10-19T07:00:00Z"));
    s.cycle = { date: d("2026-10-24"), cutoff: new Date("2026-10-23T17:00:00Z"), day: "SATURDAY" };
    await GET(req());
    expect(s.sent).toHaveLength(0);
  });

  it("doesn't remind about a week that's already confirmed", async () => {
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z"));
    s.cycle = { date: d("2026-10-24"), cutoff: new Date("2026-10-23T17:00:00Z"), day: "SATURDAY" };
    s.ordered = 1;
    await GET(req());
    expect(s.sent).toHaveLength(0);
  });

  it("skips a basket with no delivery date (no address, or every week skipped)", async () => {
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z"));
    s.cycle = { date: null, cutoff: null, day: "SATURDAY" };
    await GET(req());
    expect(s.sent).toHaveLength(0);
  });

  it("skips a basket whose produce is all sold out", async () => {
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z"));
    s.cycle = { date: d("2026-10-24"), cutoff: new Date("2026-10-23T17:00:00Z"), day: "SATURDAY" };
    s.baskets = [{ ...basket, items: [{ quantity: 1, product: { ...product("Mango"), availability: "OUT_OF_STOCK" } }] }];
    await GET(req());
    expect(s.sent).toHaveLength(0);
  });

  it("refuses callers without the cron secret once one is set", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    vi.setSystemTime(new Date("2026-10-19T07:00:00Z"));
    s.cycle = { date: null, cutoff: null, day: "SATURDAY" };
    expect((await GET(req("Bearer s3cret"))).status).toBe(200);
  });

  it("refuses everyone in production if the secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET(req())).status).toBe(401);
  });
});
