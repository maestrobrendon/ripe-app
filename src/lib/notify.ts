import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/*
 * Every message to a customer goes through here: order updates, weekly
 * reminders, cutoff nudges, invite rewards. Two channels:
 *
 * - Email, sent today through Resend (lib/email.ts).
 * - WhatsApp, the channel Lagos actually reads. No provider is connected yet,
 *   so messages are written to NotificationLog with status LOGGED; connecting
 *   one (WHATSAPP_PROVIDER) means sending them from sendWhatsApp below.
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

export async function notify(m: Message): Promise<void> {
  const prefs = m.userId
    ? await prisma.user.findUnique({ where: { id: m.userId }, select: { notifyEmail: true, notifyWhatsApp: true, erasedAt: true } })
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
}
