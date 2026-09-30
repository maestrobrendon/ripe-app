import { SITE_NAME, SITE_TAGLINE, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/site";

/**
 * Every brand-level string lives here. Components import from this file
 * instead of hard-coding the name, contacts, or WhatsApp green, so a rename
 * is a change here (and in `lib/site.ts`, which this wraps) rather than a
 * hunt across the app.
 */
export const brand = {
  name: SITE_NAME,
  tagline: SITE_TAGLINE,
  email: SUPPORT_EMAIL,
  whatsapp: {
    number: SUPPORT_WHATSAPP,
    prefill: `Hi ${SITE_NAME}, I have a question about`,
    /** WhatsApp's own brand colour is the one allowed off-system hex. */
    color: "#25D366",
  },
  /** Customer copy never calls the assistant "AI" — it's Kachi. */
  assistantName: "Kachi",
} as const;

export type Brand = typeof brand;
