"use client";

import { removePushSubscription, savePushSubscription } from "@/app/(site)/app-actions";

/*
 * Basket as an installed app, from the browser's side: is it installed, can
 * this browser install it, and app notifications on this device. Used by
 * Kachi's nudge (app-setup.tsx) and the Me screen.
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Chrome, Edge and Samsung offer their own install dialog, once, early: keep it for when Kachi asks.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    remember({ installed: true });
    listeners.forEach((l) => l());
  });
}

export const onInstallChange = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const canPromptInstall = () => deferred !== null;

/** Show the browser's own install dialog. True if the customer said yes. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") remember({ installed: true });
  return outcome === "accepted";
}

/** Opened from the home screen, not a browser tab. */
export function isInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type Platform = "ios" | "android" | "desktop";

export function platform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** iOS browsers other than Safari keep Share at the top right instead of the bottom. */
export const iosShareAtTop = () => /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

/* -------------------------------- remembering ------------------------------- */

type Memory = { installed?: boolean; installAsked?: number; installNextAt?: number; pushAsked?: number; pushNextAt?: number };
const KEY = "basket.app";

export function recall(): Memory {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Memory;
  } catch {
    return {};
  }
}

export function remember(patch: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...recall(), ...patch }));
  } catch {
    /* private mode: Kachi may ask again, which is fine */
  }
}

/* ---------------------------- app notifications ---------------------------- */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported() {
  return typeof window !== "undefined" && Boolean(VAPID) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * iPhones only allow notifications for an app on the home screen. Elsewhere
 * a browser tab can have them too.
 */
export const pushNeedsInstall = () => platform() === "ios" && !isInstalled();

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => null);
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushOutcome = "on" | "denied" | "unsupported" | "needs-install" | "failed";

/** Ask for permission (if needed), subscribe this device, and tell the server. */
export async function enablePush({ welcome = true } = {}): Promise<PushOutcome> {
  if (!pushSupported()) return "unsupported";
  if (pushNeedsInstall()) return "needs-install";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  try {
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }));
    const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent, welcome);
    return r.ok ? "on" : "failed";
  } catch {
    return "failed";
  }
}

/** Stop app notifications on this device. */
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Quietly make sure a device that already allowed notifications is on file (it may have been renewed). */
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await savePushSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent, false).catch(() => {});
}

/** Open Kachi's "get the app" sheet from anywhere (the Me screen uses it). */
export const openGetApp = () => window.dispatchEvent(new Event("basket:get-app"));
