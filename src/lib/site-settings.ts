import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SETTING_DEFAULTS, SETTING_KEYS, SETTING_SCHEMAS, type SiteSettings } from "@/lib/site-settings-schema";

/**
 * The site's settings, once per request. Missing or unparseable values fall
 * back to their defaults (see site-settings-schema.ts). Server code reads
 * this directly; client components get it from SiteSettingsProvider.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: SETTING_KEYS } } }).catch(() => []);
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    const parsed = SETTING_SCHEMAS[key].safeParse(stored.get(key));
    if (parsed.success) out[key] = parsed.data;
  }
  return out as SiteSettings;
});

/** The WhatsApp link for the support line. */
export const whatsappHref = (number: string) => `https://wa.me/${number}`;
