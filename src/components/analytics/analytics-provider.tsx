"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { CONSENT_CHOSEN_EVENT, OPEN_CONSENT_EVENT, readConsent, track, writeConsent, type Consent } from "@/lib/analytics";
import { ConsentBanner } from "./consent-banner";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
/** Off in local development unless asked for, so testing doesn't fill the dashboards. */
const ENABLED = Boolean(KEY) && (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_POSTHOG_DEV === "1");

export type AnalyticsUser = { id: string; name: string; email: string | null; member: boolean; tier: string | null } | null;

/** Turns on everything analytics cookies cover, now and for this visit. */
function grant(user: AnalyticsUser) {
  posthog.set_config({ persistence: "localStorage+cookie", enable_heatmaps: true, capture_dead_clicks: true });
  posthog.startSessionRecording();
  if (user) posthog.identify(user.id, { name: user.name, email: user.email, member: user.member, tier: user.tier });
}

/**
 * Starts PostHog once per page load, at the level the visitor's cookie
 * choice allows, and shows the cookie banner until they've made one. Also times how long each [data-track-section]
 * is on screen, so the dashboards can show which parts of a page people
 * actually stop on.
 */
export function AnalyticsProvider({ user, dockAware = false }: { user: AnalyticsUser; dockAware?: boolean }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [asking, setAsking] = useState(false);
  // Opened from a "Cookie settings" link: start on the categories, not the question.
  const [inSettings, setInSettings] = useState(false);

  // The banner is about cookies, so it shows whether or not analytics runs here.
  useEffect(() => {
    const c = readConsent();
    // Reading the cookie after mount keeps the first render the same on server and client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(c);
    setAsking(c === null);
  }, []);

  useEffect(() => {
    if (!ENABLED || posthog.__loaded) return;
    const granted = readConsent() === "granted";
    posthog.init(KEY!, {
      // Through our own domain (next.config.ts rewrites), so blockers don't drop it.
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: true,
      person_profiles: "identified_only",
      persistence: granted ? "localStorage+cookie" : "memory",
      disable_session_recording: !granted,
      enable_heatmaps: granted,
      capture_dead_clicks: granted,
      capture_performance: { web_vitals: true },
      session_recording: { maskAllInputs: true, maskTextSelector: "[data-ph-mask]" },
    });
    if (granted && user) posthog.identify(user.id, { name: user.name, email: user.email, member: user.member, tier: user.tier });
  }, [user]);

  // "Cookie settings" in the footer and the policies opens the categories again.
  useEffect(() => {
    const open = () => {
      setInSettings(true);
      setAsking(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  // Time on screen for each marked section of this page.
  useEffect(() => {
    if (!ENABLED) return;
    const started = new Map<Element, number>();
    const flush = (el: Element) => {
      const t = started.get(el);
      if (t === undefined) return;
      started.delete(el);
      // Capped at ten minutes: past that, the page was left open, not read.
      const seconds = Math.min(600, Math.round((performance.now() - t) / 100) / 10);
      if (seconds >= 1) track("section_viewed", { section: el.getAttribute("data-track-section"), seconds, path: pathname });
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.4) {
            if (!started.has(e.target)) started.set(e.target, performance.now());
          } else flush(e.target);
        }
      },
      { threshold: [0, 0.4] },
    );
    // Sections render after navigation, so look for them a beat later.
    const watch = () => document.querySelectorAll("[data-track-section]").forEach((el) => io.observe(el));
    const t = window.setTimeout(watch, 600);
    const leave = () => [...started.keys()].forEach(flush);
    // A tab in the background isn't being read: stop the clocks, and start
    // again (re-observing reports what's on screen) when it comes back.
    const visibility = () => {
      if (document.hidden) {
        leave();
        io.disconnect();
      } else watch();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(t);
      leave();
      io.disconnect();
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pathname]);

  const choose = (c: "granted" | "denied") => {
    writeConsent(c);
    setConsent(c);
    setAsking(false);
    setInSettings(false);
    window.dispatchEvent(new Event(CONSENT_CHOSEN_EVENT));
    if (!ENABLED) return;
    if (c === "granted") grant(user);
    else {
      posthog.stopSessionRecording();
      posthog.set_config({ persistence: "memory", enable_heatmaps: false, capture_dead_clicks: false });
      posthog.reset();
    }
    track("cookie_consent", { choice: c });
  };

  if (!asking) return null;
  return <ConsentBanner key={String(inSettings)} current={consent} onChoose={choose} dockAware={dockAware} startInSettings={inSettings} />;
}
