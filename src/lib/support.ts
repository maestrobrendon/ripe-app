import { SUPPORT_WHATSAPP } from "@/lib/site";

/*
 * How a customer reaches a person. WhatsApp first, the way Lagos expects; but
 * while the business number in Site settings is still the placeholder, every
 * "message us" falls back to email instead of a number nobody answers.
 * Client-safe: pass it the support settings.
 */

export type SupportContact = { whatsapp: string; email: string };

export const whatsappReady = (s: SupportContact) => /^\d{10,15}$/.test(s.whatsapp) && s.whatsapp !== SUPPORT_WHATSAPP;

/** A link that opens a conversation with us, prefilled with `message` when there is one. */
export function supportHref(s: SupportContact, message?: string, subject = "Help with Basket"): string {
  if (whatsappReady(s)) return `https://wa.me/${s.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  const q = new URLSearchParams({ subject, ...(message ? { body: message } : {}) });
  return `mailto:${s.email}?${q.toString().replace(/\+/g, "%20")}`;
}

/** "Chat with us on WhatsApp" or "Email us", matching supportHref. */
export const supportLabel = (s: SupportContact) => (whatsappReady(s) ? "Chat with us on WhatsApp" : "Email us");

/** The channel, for sentences: "Message us on WhatsApp" / "Email us". */
export const supportVerb = (s: SupportContact) => (whatsappReady(s) ? "Message us on WhatsApp" : "Email us");
