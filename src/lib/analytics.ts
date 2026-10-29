"use client";

import type { PostHog } from "posthog-js";

/*
 * Product analytics (PostHog), governed by the cookie choice. Two levels:
 *
 *   Before a choice, or analytics cookies rejected: page views, time on page,
 *   clicks (autocapture), web vitals and the named events below, held in
 *   memory only. Nothing is stored on the device, so nothing ties one visit
 *   to the next.
 *   Analytics cookies accepted: the same, remembered across visits, plus
 *   session replay, heatmaps, dead-click detection, and (signed in) the
 *   account, so one person's journey can be followed end to end.
 *
 * The choice is a cookie of its own (CONSENT_COOKIE, 12 months), the way
 * cookie banners work everywhere. Passwords, payment and address fields are
 * always masked in replays. See /cookies for the full list.
 */

export const CONSENT_COOKIE = "basket_cookie_consent";
/** The earlier name of the choice, in localStorage; read once so nobody is asked twice. */
const LEGACY_KEY = "basketng.analytics-consent";
export const OPEN_CONSENT_EVENT = "basketng:open-cookie-settings";
/** Fired once the visitor has answered the cookie banner, for prompts that wait their turn. */
export const CONSENT_CHOSEN_EVENT = "basketng:cookie-choice";

/** "granted": analytics cookies accepted. "denied": essential cookies only. null: not asked yet. */
export type Consent = "granted" | "denied" | null;

export function readConsent(): Consent {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
    const v = m?.[1] ?? localStorage.getItem(LEGACY_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(c: "granted" | "denied") {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${c}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* the choice holds for this visit */
  }
}

/** Opens the cookie settings from anywhere (footer, cookie policy, privacy policy). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

/*
 * PostHog itself is downloaded only once the page has loaded (see
 * components/analytics): at about 300 KB with session replay it was the
 * biggest script on the first load. Until then, and on the server, ph is
 * null and every call here quietly does nothing.
 */
let ph: PostHog | null = null;

/** Loads PostHog (once) and hands it back. */
export async function loadPostHog(): Promise<PostHog> {
  if (!ph) ph = (await import("posthog-js")).default;
  return ph;
}

/** The loaded, started PostHog, or null. */
export function posthogNow(): PostHog | null {
  return ph && ph.__loaded ? ph : null;
}

export function analyticsReady() {
  return typeof window !== "undefined" && posthogNow() !== null;
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
  | "cookie_consent";

/** Record a named event. A no-op until PostHog has loaded, and on the server. */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  posthogNow()?.capture(event, properties);
}

/** A timestamp for measuring how long something took, in milliseconds. */
export const clock = () => performance.now();
/** Milliseconds since a clock() reading, rounded. */
export const since = (start: number) => Math.round(performance.now() - start);
