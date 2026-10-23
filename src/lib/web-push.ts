import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/*
 * App notifications (Web Push). Each device a customer turns notifications on
 * for is a PushSubscription row; a message goes to every one of them. Needs
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT; without
 * them nothing is sent and notify() logs the message instead.
 */

let ready: boolean | null = null;

export function pushConfigured() {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@getbasket.ng", pub, priv);
  return (ready = true);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Send to every device of this customer. Returns how many accepted it. */
export async function sendWebPush(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
        sent++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The browser dropped this subscription (app removed, permission revoked): forget it.
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.warn(JSON.stringify({ scope: "push", error: "send failed", status }));
      }
    }),
  );
  return sent;
}
