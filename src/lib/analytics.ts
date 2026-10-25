"use client";

import posthog from "posthog-js";

/*
 * Product analytics (PostHog). Two levels:
 *
 *   Everyone:  page views, time on page, clicks (autocapture), web vitals and
 *              the named events below, with nothing stored in the browser,
 *              so nothing ties one visit to the next.
 *   "Allow":   the same, remembered across visits, plus session replay,
 *              heatmaps, dead-click detection, and (signed in) the account,
 *              so one person's journey can be followed end to end.
 *
 * The choice lives in localStorage under CONSENT_KEY. Passwords, payment
 * and address fields are always masked in replays.
 */

export const CONSENT_KEY = "basketng.analytics-consent";
export const OPEN_CONSENT_EVENT = "basketng:open-consent";

export type Consent = "granted" | "denied" | null;

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function analyticsReady() {
  return typeof window !== "undefined" && posthog.__loaded;
}

/** The named moments worth counting by name, rather than by which button was clicked. */
export type AnalyticsEvent =
  | "product_added"
  | "product_removed"
  | "product_quantity_changed"
  | "recipe_opened"
  | "recipe_saved"
  | "recipe_unsaved"
  | "kachi_message_sent"
  | "kachi_replied"
  | "checkout_submitted"
  | "checkout_failed"
  | "section_viewed"
  | "analytics_consent";

/** Record a named event. A no-op until PostHog has loaded, and on the server. */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!analyticsReady()) return;
  posthog.capture(event, properties);
}

/** A timestamp for measuring how long something took, in milliseconds. */
export const clock = () => performance.now();
/** Milliseconds since a clock() reading, rounded. */
export const since = (start: number) => Math.round(performance.now() - start);
