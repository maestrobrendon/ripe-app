import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  subs: [] as { id: string; endpoint: string; p256dh: string; auth: string }[],
  deleted: [] as string[],
  sentTo: [] as string[],
  failWith: {} as Record<string, number>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: async () => s.subs,
      update: async () => ({}),
      delete: async ({ where }: { where: { id: string } }) => void s.deleted.push(where.id),
    },
  },
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }) => {
      const code = s.failWith[sub.endpoint];
      if (code) throw Object.assign(new Error("push failed"), { statusCode: code });
      s.sentTo.push(sub.endpoint);
    },
  },
}));

const sub = (id: string) => ({ id, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" });

beforeEach(() => {
  vi.resetModules();
  s.subs = [];
  s.deleted = [];
  s.sentTo = [];
  s.failWith = {};
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
});

describe("app notifications", () => {
  it("sends to every device the customer turned notifications on for", async () => {
    const { sendWebPush } = await import("./web-push");
    s.subs = [sub("phone"), sub("laptop")];
    expect(await sendWebPush("u", { title: "Hi", body: "There" })).toBe(2);
    expect(s.sentTo).toHaveLength(2);
  });

  it("forgets a device the browser says is gone, and keeps one that failed for another reason", async () => {
    const { sendWebPush } = await import("./web-push");
    s.subs = [sub("gone"), sub("expired"), sub("flaky"), sub("ok")];
    s.failWith = { "https://push.example/gone": 410, "https://push.example/expired": 404, "https://push.example/flaky": 500 };
    expect(await sendWebPush("u", { title: "Hi", body: "There" })).toBe(1);
    expect(s.deleted.sort()).toEqual(["expired", "gone"]);
  });

  it("sends nothing without the keys", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const { sendWebPush, pushConfigured } = await import("./web-push");
    s.subs = [sub("phone")];
    expect(pushConfigured()).toBe(false);
    expect(await sendWebPush("u", { title: "Hi", body: "There" })).toBe(0);
  });
});
