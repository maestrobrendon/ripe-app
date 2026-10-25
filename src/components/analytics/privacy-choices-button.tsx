"use client";

import { OPEN_CONSENT_EVENT } from "@/lib/analytics";

/** Opens the analytics question again, wherever it's shown. */
export function PrivacyChoicesButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))} className={className}>
      Change your analytics choice
    </button>
  );
}
