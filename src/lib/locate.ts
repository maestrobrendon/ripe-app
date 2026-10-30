"use client";

/**
 * "Use my location", once, for every button that offers it: the area
 * question, sign-up, the delivery areas page, the homepage and pinning an
 * address. It asks for a precise fix and falls back to a rough one, never
 * waits forever, and says why it failed in words a customer can act on.
 */

export type Located = { lat: number; lng: number; /** metres */ accuracy: number };

export type LocateFailure =
  /** The browser has no location at all. */
  | "unsupported"
  /** The visitor, or the phone's settings, said no. */
  | "denied"
  /** The phone couldn't get a fix in time, or at all. */
  | "unavailable"
  /** A fix came back, but too rough to tell one area from another. */
  | "imprecise";

/** Past this, a fix can't tell Yaba from Surulere, so it isn't used to say "not in your area". */
const ROUGH_M = 3000;

function once(options: PositionOptions): Promise<Located> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      reject,
      options,
    ),
  );
}

/** Where the visitor is. Rejects with a LocateFailure. */
export async function locate(): Promise<Located> {
  if (typeof navigator === "undefined" || !navigator.geolocation) throw "unsupported" satisfies LocateFailure;
  try {
    // GPS where there is one; a recent fix is as good as a new one.
    return await once({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 300_000 });
  } catch (e) {
    if ((e as GeolocationPositionError).code === 1) throw "denied" satisfies LocateFailure;
  }
  try {
    // Indoors, or no GPS: Wi-Fi and the network are close enough to find an area.
    return await once({ enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 });
  } catch (e) {
    throw ((e as GeolocationPositionError).code === 1 ? "denied" : "unavailable") satisfies LocateFailure;
  }
}

export type AreaZone = { slug: string; name: string; area: string; deliveryDays: string[] };

export type AreaResult =
  | { kind: "zone"; zone: AreaZone; at: Located }
  | { kind: "outside"; at: Located }
  | { kind: "failed"; reason: LocateFailure };

/**
 * Finds the visitor and the area that covers them. The server remembers the
 * area (the same cookie the area picker sets), so the rest of the site knows it.
 */
export async function findMyArea(): Promise<AreaResult> {
  let at: Located;
  try {
    at = await locate();
  } catch (reason) {
    return { kind: "failed", reason: reason as LocateFailure };
  }
  try {
    const res = await fetch("/api/zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: at.lat, lng: at.lng, accuracy: at.accuracy }),
    });
    const data: { zone?: AreaZone } = await res.json();
    if (data.zone) return { kind: "zone", zone: data.zone, at };
  } catch {
    return { kind: "failed", reason: "unavailable" };
  }
  // Too rough to be sure they're outside: let them pick instead of turning them away.
  return at.accuracy > ROUGH_M ? { kind: "failed", reason: "imprecise" } : { kind: "outside", at };
}

/** What to tell someone when finding them didn't work, and what to do instead. */
export function locateHelp(reason: LocateFailure, instead = "Pick your area instead."): string {
  if (reason === "denied") {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua))
      return `Location is off for this site. To turn it on: Settings › Privacy & Security › Location Services › Safari Websites › While Using the App. Or ${lower(instead)}`;
    if (/Android/.test(ua)) return `Location is off for this site. Tap the icon left of the web address › Permissions › Location. Or ${lower(instead)}`;
    return `Your browser is blocking location for this site. Allow it from the icon left of the web address, or ${lower(instead)}`;
  }
  if (reason === "imprecise") return `We couldn't pin down where you are closely enough. ${instead}`;
  if (reason === "unsupported") return `This browser can't share your location. ${instead}`;
  return `Your phone couldn't find you just now. ${instead}`;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
