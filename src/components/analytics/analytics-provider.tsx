"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { CONSENT_KEY, OPEN_CONSENT_EVENT, readConsent, track, type Consent } from "@/lib/analytics";
import { ConsentBanner } from "./consent-banner";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
/** Off in local development unless asked for, so testing doesn't fill the dashboards. */
const ENABLED = Boolean(KEY) && (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_POSTHOG_DEV === "1");

export type AnalyticsUser = { id: string; name: string; email: string | null; member: boolean; tier: string | null } | null;

/** Turns on everything "Allow" covers, now and for this visit. */
function grant(user: AnalyticsUser) {
  posthog.set_config({ persistence: "localStorage+cookie", enable_heatmaps: true, capture_dead_clicks: true });
  posthog.startSessionRecording();
  if (user) posthog.identify(user.id, { name: user.name, email: user.email, member: user.member, tier: user.tier });
}

/**
 * Starts PostHog once per page load, at the level the visitor chose, and
 * asks them the first time. Also times how long each [data-track-section]
 * is on screen, so the dashboards can show which parts of a page people
 * actually stop on.
 */
export function AnalyticsProvider({ user, dockAware = false }: { user: AnalyticsUser; dockAware?: boolean }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!ENABLED || posthog.__loaded) return;
    const c = readConsent();
    const granted = c === "granted";
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
    // Reading storage after mount keeps the first render the same on server and client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(c);
    setAsking(c === null);
  }, [user]);

  // Privacy page and footer can ask again.
  useEffect(() => {
    const open = () => setAsking(true);
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
      const seconds = Math.round((performance.now() - t) / 100) / 10;
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
    const t = window.setTimeout(() => document.querySelectorAll("[data-track-section]").forEach((el) => io.observe(el)), 600);
    const leave = () => [...started.keys()].forEach(flush);
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearTimeout(t);
      leave();
      io.disconnect();
      window.removeEventListener("pagehide", leave);
    };
  }, [pathname]);

  const choose = (c: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_KEY, c);
    } catch {
      /* the choice holds for this visit */
    }
    setConsent(c);
    setAsking(false);
    if (!ENABLED) return;
    if (c === "granted") grant(user);
    else {
      posthog.stopSessionRecording();
      posthog.set_config({ persistence: "memory", enable_heatmaps: false, capture_dead_clicks: false });
      posthog.reset();
    }
    track("analytics_consent", { choice: c });
  };

  if (!asking) return null;
  return <ConsentBanner current={consent} onChoose={choose} dockAware={dockAware} />;
}
