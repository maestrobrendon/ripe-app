"use client";

import { openCookieSettings } from "@/lib/analytics";

/** Opens the cookie settings, wherever it's shown. */
export function PrivacyChoicesButton({ className = "", children = "Cookie settings" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {children}
    </button>
  );
}
