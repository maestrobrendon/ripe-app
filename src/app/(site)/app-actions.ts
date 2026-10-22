"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { sendWebPush } from "@/lib/web-push";

/*
 * The app on the customer's phone: remembering a device that turned
 * notifications on, forgetting it, and a test message to show it works.
 */

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Result = { ok: true } | { ok: false; error: string };

const valid = (s: Sub) =>
  typeof s?.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";

/** This device can now receive app notifications. Also turns the App notifications setting on. */
export async function savePushSubscription(sub: Sub, userAgent: string, welcome: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to turn on notifications." };
  if (!valid(sub)) return { ok: false, error: "This browser didn't give us what we need for notifications." };
  const data = { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 300) };
  // An endpoint belongs to one browser profile: if someone else signs in on it, it moves to them.
  await prisma.pushSubscription.upsert({ where: { endpoint: sub.endpoint }, create: { endpoint: sub.endpoint, ...data }, update: data });
  if (!user.notifyPush) await prisma.user.update({ where: { id: user.id }, data: { notifyPush: true } });
  if (welcome) {
    await sendWebPush(user.id, { title: "Notifications are on", body: "We'll tell you here before each basket closes, and when it's on its way.", url: "/basket", tag: "welcome" }).catch(() => {});
  }
  revalidatePath("/account");
  return { ok: true };
}

/** Forget this device (notifications turned off here, or the browser dropped them). */
export async function removePushSubscription(endpoint: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  revalidatePath("/account");
  return { ok: true };
}
