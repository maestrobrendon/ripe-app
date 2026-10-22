/*
 * Haptics: a small physical "tick" that confirms a tap landed, the way iOS
 * does. Call it on the press itself, in the same frame as the visual change.
 *
 * - Android (and other browsers with the Vibration API): short vibration
 *   patterns, tuned to feel like taps rather than buzzes.
 * - iPhone: Safari has no vibration API, but since iOS 18 toggling a native
 *   switch (<input type="checkbox" switch>) plays the system haptic, so we
 *   toggle a hidden one. It only works inside a user gesture, which is when
 *   we call it anyway.
 *
 * Used sparingly, for moments that matter: selection changes, adding,
 * confirming, and errors. Silent everywhere else.
 */

export type Haptic = "selection" | "light" | "success" | "warning" | "error";

const VIBRATION: Record<Haptic, number | number[]> = {
  selection: 6,
  light: 10,
  success: [10, 70, 16],
  warning: [16, 60, 16],
  error: [24, 50, 24, 50, 24],
};

/** How many system ticks each one is on iPhone. */
const IOS_TICKS: Record<Haptic, number> = { selection: 1, light: 1, success: 2, warning: 2, error: 3 };

let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip-path:inset(50%)";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function haptic(kind: Haptic = "light") {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function" && !isIOS()) {
      navigator.vibrate(VIBRATION[kind]);
      return;
    }
    if (isIOS()) {
      const n = IOS_TICKS[kind];
      iosTick();
      for (let i = 1; i < n; i++) window.setTimeout(iosTick, i * 90);
    }
  } catch {
    /* no haptics here: the visual feedback still carries it */
  }
}
