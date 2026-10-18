import { z } from "zod";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/site";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";

/*
 * Site-wide settings staff can change without a deploy. Each key has a zod
 * schema and a default; a stored value that doesn't parse falls back to the
 * default, so a bad edit can never break a page. Client-safe (no database).
 */

export const SETTING_SCHEMAS = {
  announcement: z.object({
    /** Shown in the bar above the site for visitors who aren't signed in. */
    text: z.string().trim().min(3).max(140),
  }),
  support: z.object({
    /** International format, digits only: 2348031234567. */
    whatsapp: z.string().regex(/^\d{10,15}$/, "Digits only, with the country code (e.g. 2348031234567)"),
    email: z.string().trim().toLowerCase().email().max(254),
  }),
  delivery: z.object({
    /** Cart value at or above which delivery is free for everyone. */
    freeThreshold: z.number().int().min(0).max(10_000_000),
  }),
  transfer: z.object({
    /** The account customers who pick "Bank transfer" pay into. All empty: transfer isn't offered. */
    bankName: z.string().trim().max(60),
    accountName: z.string().trim().max(80),
    accountNumber: z.string().regex(/^(\d{10})?$/, "A 10-digit NUBAN, or empty"),
  }),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SiteSettings = { [K in SettingKey]: z.infer<(typeof SETTING_SCHEMAS)[K]> };

export const SETTING_DEFAULTS: SiteSettings = {
  announcement: { text: "Freshly selected fruit and vegetables, delivered across Lagos." },
  support: { whatsapp: SUPPORT_WHATSAPP, email: SUPPORT_EMAIL },
  delivery: { freeThreshold: FREE_DELIVERY_THRESHOLD },
  transfer: { bankName: "", accountName: "", accountNumber: "" },
};

/** Whether there's an account to pay into, so checkout can offer bank transfer. */
export const transferReady = (t: SiteSettings["transfer"]) => Boolean(t.bankName && t.accountName && t.accountNumber);

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];
