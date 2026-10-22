"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { KachiMark } from "@/components/kachi-mark";
import {
  canPromptInstall,
  enablePush,
  inAppBrowser,
  iosShareAtTop,
  isInstalled,
  onInstallChange,
  platform,
  promptInstall,
  pushSupported,
  recall,
  registerServiceWorker,
  remember,
  syncPush,
  type Platform,
  type PushOutcome,
} from "./pwa";

/*
 * Kachi's offer to put Basket on the customer's home screen, and once it's
 * there, to turn on notifications. For signed-in customers only.
 *
 * - It waits a few seconds into a visit, and never during checkout.
 * - "Not now" waits 5 days; after 3 of those it stops asking. Installing
 *   (or turning notifications on) ends it for good on that device.
 * - The Me screen can open it any time ("Get the app").
 *
 * Chrome, Edge and Samsung install in one tap; Safari on iPhone needs two
 * steps of its own, which the sheet shows.
 */

const DELAY_MS = 6_000;
const SNOOZE_MS = 5 * 86_400_000;
const MAX_ASKS = 3;
const QUIET = [/^\/checkout/, /^\/login/, /^\/signup/, /^\/start/];

type Sheet = null | "install" | "push";

export function AppSetup() {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [manual, setManual] = useState(false);
  const promptReady = useSyncExternalStore(onInstallChange, canPromptInstall, () => false);

  // The service worker, and a device that already allowed notifications kept on file.
  useEffect(() => {
    void registerServiceWorker().then(() => syncPush());
  }, []);

  // "Get the app" from the Me screen.
  useEffect(() => {
    const open = () => {
      setManual(true);
      setSheet(isInstalled() ? "push" : "install");
    };
    window.addEventListener("basket:get-app", open);
    return () => window.removeEventListener("basket:get-app", open);
  }, []);

  // Kachi asks, at most every few days.
  useEffect(() => {
    if (QUIET.some((r) => r.test(pathname))) return;
    const t = window.setTimeout(() => {
      if (document.querySelector("[role=dialog]")) return;
      const m = recall();
      const now = Date.now();
      if (isInstalled()) {
        const ask = pushSupported() && Notification.permission === "default" && (m.pushAsked ?? 0) < MAX_ASKS && now >= (m.pushNextAt ?? 0);
        if (ask) setSheet("push");
        return;
      }
      if (m.installed) return;
      const p = platform();
      // Desktop browsers without their own install dialog (Firefox, Safari) aren't asked; Me still offers it.
      const installable = p !== "desktop" || canPromptInstall();
      if (installable && (m.installAsked ?? 0) < MAX_ASKS && now >= (m.installNextAt ?? 0)) setSheet("install");
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const close = (snooze: boolean) => {
    if (snooze && !manual) {
      const m = recall();
      if (sheet === "install") remember({ installAsked: (m.installAsked ?? 0) + 1, installNextAt: Date.now() + SNOOZE_MS });
      if (sheet === "push") remember({ pushAsked: (m.pushAsked ?? 0) + 1, pushNextAt: Date.now() + SNOOZE_MS });
    }
    setSheet(null);
    setManual(false);
  };

  return (
    <>
      <BottomSheet open={sheet === "install"} onClose={() => close(true)} title="Get the app" desktopDialog>
        <InstallBody promptReady={promptReady} onInstalled={() => close(false)} onLater={() => close(true)} />
      </BottomSheet>
      <BottomSheet open={sheet === "push"} onClose={() => close(true)} title="Notifications" desktopDialog>
        <PushBody onDone={() => close(false)} onLater={() => close(true)} />
      </BottomSheet>
    </>
  );
}

function KachiSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <KachiMark className="size-8" />
      <p className="rounded-[18px] rounded-tl-md bg-soft-mist px-3.5 py-2.5 text-[15px] leading-snug">{children}</p>
    </div>
  );
}

function AppTile() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="flex size-16 items-center justify-center rounded-[18px] bg-carbon font-display text-[34px] leading-none text-paper-white shadow-lg">B</span>
      <span className="text-[13px] font-medium">Basket</span>
    </div>
  );
}

function InstallBody({ promptReady, onInstalled, onLater }: { promptReady: boolean; onInstalled: () => void; onLater: () => void }) {
  const [p] = useState<Platform>(() => (typeof window === "undefined" ? "android" : platform()));
  const [inApp] = useState<string | null>(() => (typeof window === "undefined" ? null : inAppBrowser()));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/basket`);
      setCopied(true);
    } catch {
      /* the steps still work without it */
    }
  };

  // Inside Instagram, Facebook and the like: first get out into the real browser.
  if (inApp) {
    const browser = p === "ios" ? "Safari" : "Chrome";
    return (
      <div>
        <KachiSays>
          You&apos;re in {inApp}&apos;s browser, which can&apos;t add apps to your home screen. Open Basket in {browser} first, then I&apos;ll show you the rest.
        </KachiSays>
        <ol className="mt-6 grid gap-2">
          <Step n={1} icon="more">
            Tap the <b className="font-semibold">menu</b> ({p === "ios" ? "•••" : "⋮"}) {p === "ios" ? "or the share button" : "at the top right"}
          </Step>
          <Step n={2} icon="share">
            Choose <b className="font-semibold">Open in {browser}</b> (or Open in browser)
          </Step>
          <Step n={3} icon="checkPlain">
            You&apos;re still signed in there. I&apos;ll pop up to help you add it.
          </Step>
        </ol>
        <div className="mt-5 grid gap-2">
          <Button size="lg" variant="secondary" className="w-full" onClick={copyLink}>
            {copied ? "Link copied. Paste it into " + browser : "Copy the link instead"}
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={onLater}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  const install = async () => {
    setBusy(true);
    const yes = await promptInstall();
    setBusy(false);
    if (yes) onInstalled();
  };

  return (
    <div>
      <KachiSays>Put Basket on your home screen. It opens in one tap, like any app, and your basket reminders arrive as notifications.</KachiSays>
      <div className="mt-5 flex justify-center">
        <AppTile />
      </div>

      {promptReady ? (
        <div className="mt-6 grid gap-2">
          <Button size="lg" className="w-full" loading={busy} onClick={install}>
            Add Basket
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={onLater}>
            Not now
          </Button>
        </div>
      ) : (
        <>
          <ol className="mt-6 grid gap-2">
            {p === "ios" ? (
              <>
                <Step n={1} icon="share">
                  Tap <b className="font-semibold">Share</b> {iosShareAtTop() ? "at the top right of your browser" : "at the bottom of Safari"}
                </Step>
                <Step n={2} icon="addSquare">
                  Choose <b className="font-semibold">Add to Home Screen</b>
                </Step>
                <Step n={3} icon="checkPlain">
                  Tap <b className="font-semibold">Add</b>. Basket is on your home screen.
                </Step>
                <p className="px-1 pt-1 text-[13px] text-muted">
                  No &quot;Add to Home Screen&quot;? You may be in WhatsApp&apos;s browser: tap the compass or &quot;Open in Safari&quot; first.
                </p>
              </>
            ) : p === "android" ? (
              <>
                <Step n={1} icon="more">
                  Tap your browser&apos;s <b className="font-semibold">menu</b> (⋮)
                </Step>
                <Step n={2} icon="addSquare">
                  Choose <b className="font-semibold">Install app</b> or <b className="font-semibold">Add to Home screen</b>
                </Step>
                <p className="px-1 pt-1 text-[13px] text-muted">
                  Don&apos;t see it? Tap <b className="font-semibold">Open in Chrome</b> in the menu first.
                </p>
              </>
            ) : (
              <>
                <Step n={1} icon="download">
                  In Chrome or Edge, click the <b className="font-semibold">install</b> icon at the right of the address bar
                </Step>
                <Step n={2} icon="share">
                  In Safari on a Mac, choose <b className="font-semibold">File → Add to Dock</b>
                </Step>
              </>
            )}
          </ol>
          <Button size="lg" variant="secondary" className="mt-5 w-full" onClick={onLater}>
            Got it
          </Button>
        </>
      )}
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: IconName; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-soft-mist px-3 py-3 text-[15px]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] font-semibold">{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <Icon name={icon} size={20} className="shrink-0" />
    </li>
  );
}

const PUSH_ERROR: Partial<Record<PushOutcome, string>> = {
  denied: "Notifications are blocked for Basket. You can allow them in your phone's settings, under Notifications.",
  unsupported: "This browser can't show notifications. Email and WhatsApp reminders still come.",
  "needs-install": "On iPhone, add Basket to your home screen first. Then notifications can be turned on.",
  failed: "That didn't work. Try again in a moment.",
};

function PushBody({ onDone, onLater }: { onDone: () => void; onLater: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    if (r === "on") {
      remember({ pushAsked: MAX_ASKS });
      onDone();
    } else setError(PUSH_ERROR[r] ?? PUSH_ERROR.failed!);
  };

  return (
    <div>
      <KachiSays>Want me to tap you on the shoulder? I&apos;ll let you know a few days before your basket closes, and when it&apos;s on its way. Nothing else.</KachiSays>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-ember/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-2">
        <Button size="lg" className="w-full" loading={busy} onClick={turnOn}>
          Turn on notifications
        </Button>
        <Button size="lg" variant="secondary" className="w-full" onClick={onLater}>
          Not now
        </Button>
      </div>
    </div>
  );
}
