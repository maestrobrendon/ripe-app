"use client";

import { formatNaira } from "@/lib/format";
import { useSiteSettings } from "@/components/site-settings-provider";

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

/** The support WhatsApp link, optionally with a prefilled message. */
export function useWhatsappHref(text?: string): string {
  const { support } = useSiteSettings();
  return `https://wa.me/${support.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
