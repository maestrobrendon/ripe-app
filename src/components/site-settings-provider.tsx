"use client";

import { createContext, useContext, type ReactNode } from "react";
import { SETTING_DEFAULTS, type SiteSettings } from "@/lib/site-settings-schema";

/*
 * Site settings for client components. The root layouts load them with
 * getSiteSettings() (src/lib/site-settings.ts) and wrap the page in this.
 */

const SettingsContext = createContext<SiteSettings>(SETTING_DEFAULTS);

export function SiteSettingsProvider({ settings, children }: { settings: SiteSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSiteSettings(): SiteSettings {
  return useContext(SettingsContext);
}
