import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { pushConfigured, sendWebPush } from "@/lib/web-push";

/*
 * Every message to a customer goes through here: order updates, the
 * reminders before each basket's delivery, invite rewards. Three channels,
 * all sent together:
 *
 * - Email, sent today through Resend (lib/email.ts).
 * - WhatsApp, the channel Lagos actually reads. The business number is being
 *   approved by Meta; until WHATSAPP_PROVIDER is set, messages are written to
 *   NotificationLog as LOGGED, and connecting it means sending from
 *   sendWhatsApp below. Nothing else changes.
 * - App notifications (Web Push, lib/web-push.ts) to every device the
 *   customer turned them on for. Logged instead until the VAPID keys are set,
 *   or while the customer has no device subscribed.
 *
 * Each message has a dedupeKey, so a scheduled reminder goes out once per
 * channel however often the job runs. Customers' channel choices
 * (notifyEmail / notifyWhatsApp) are respected for everything except
 * messages they asked for (a reset link), marked `essential`.
 */

type Message = {
  userId: string | null;
  kind: string;
  dedupeKey: string;
  essential?: boolean;
  email?: { to: string | null | undefined; subject: string; text: string; html?: string };
  whatsapp?: { to: string | null | undefined; text: string };
  /** A short app notification; `url` is where tapping it goes. */
  push?: { title: string; body: string; url: string };
};

async function claim(dedupeKey: string, data: { userId: string | null; channel: string; kind: string; to: string; body: string }) {
  try {
    return await prisma.notificationLog.create({ data: { ...data, dedupeKey, status: "PENDING" } });
  } catch {
    return null; // Already sent (or being sent) under this key.
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Whatever WhatsApp provider is connected. None yet, so the message stays in
 * the log for staff to see (and to send from once a provider is set up).
 */
async function sendWhatsApp(to: string, text: string): Promise<"SENT" | "LOGGED" | "FAILED"> {
  if (!process.env.WHATSAPP_PROVIDER) return "LOGGED";
  console.warn(JSON.stringify({ scope: "whatsapp", note: "provider not implemented", to: to.slice(-4), length: text.length }));
  return "LOGGED";
}

/** App notifications: sent to the customer's devices, or logged if there are none (or no keys). */
async function sendPush(userId: string, push: { title: string; body: string; url: string }, kind: string): Promise<"SENT" | "LOGGED" | "FAILED"> {
  if (!pushConfigured()) return "LOGGED";
  const sent = await sendWebPush(userId, { ...push, tag: kind }).catch(() => -1);
  return sent > 0 ? "SENT" : sent < 0 ? "FAILED" : "LOGGED";
}

export async function notify(m: Message): Promise<void> {
  const prefs = m.userId
    ? await prisma.user.findUnique({ where: { id: m.userId }, select: { notifyEmail: true, notifyWhatsApp: true, notifyPush: true, erasedAt: true } })
    : null;
  if (prefs?.erasedAt) return;

  if (m.email?.to && (m.essential || prefs?.notifyEmail !== false)) {
    const row = await claim(`${m.dedupeKey}:email`, { userId: m.userId, channel: "EMAIL", kind: m.kind, to: m.email.to, body: m.email.text });
    if (row) {
      const html = m.email.html ?? `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#111">${escapeHtml(m.email.text).replace(/\n/g, "<br>")}</div>`;
      const ok = await sendEmail({ to: m.email.to, subject: m.email.subject, text: m.email.text, html });
      await prisma.notificationLog.update({ where: { id: row.id }, data: { status: ok ? "SENT" : "FAILED" } });
    }
  }

  if (m.whatsapp?.to && (m.essential || prefs?.notifyWhatsApp !== false)) {
    const row = await claim(`${m.dedupeKey}:whatsapp`, { userId: m.userId, channel: "WHATSAPP", kind: m.kind, to: m.whatsapp.to, body: m.whatsapp.text });
    if (row) await prisma.notificationLog.update({ where: { id: row.id }, data: { status: await sendWhatsApp(m.whatsapp.to, m.whatsapp.text) } });
  }

  if (m.push && m.userId && (m.essential || prefs?.notifyPush !== false)) {
    const row = await claim(`${m.dedupeKey}:push`, { userId: m.userId, channel: "PUSH", kind: m.kind, to: m.push.url, body: `${m.push.title}
${m.push.body}` });
    if (row) await prisma.notificationLog.update({ where: { id: row.id }, data: { status: await sendPush(m.userId, m.push, m.kind) } });
  }
}
