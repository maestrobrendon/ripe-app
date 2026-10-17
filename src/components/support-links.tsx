"use client";

import { formatNaira } from "@/lib/format";
import { useSiteSettings } from "@/components/site-settings-provider";
import { supportHref, supportVerb } from "@/lib/support";

/*
 * Live site settings inside copy that's written once as module-level JSX
 * (legal pages, FAQs): these render the current value wherever they're placed.
 */

export function SupportEmail({ className }: { className?: string }) {
  const { support } = useSiteSettings();
  return (
    <a href={`mailto:${support.email}`} className={className}>
      {support.email}
    </a>
  );
}

export function FreeDeliveryAmount() {
  return <>{formatNaira(useSiteSettings().delivery.freeThreshold)}</>;
}

/** A link to reach us (WhatsApp, or email while the number isn't set), optionally prefilled. */
export function useWhatsappHref(text?: string): string {
  return supportHref(useSiteSettings().support, text);
}

/** "Message us on WhatsApp" or "Email us", for sentences. */
export function useSupportVerb(): string {
  return supportVerb(useSiteSettings().support);
}
