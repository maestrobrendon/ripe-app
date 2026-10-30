import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const ZONE_COOKIE = "ripe_zone";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** The visitor's current delivery zone: their account zone, or the cookie zone. */
export async function getActiveZone() {
  const user = await getCurrentUser();
  if (user?.deliveryZone) return user.deliveryZone;

  const store = await cookies();
  const slug = store.get(ZONE_COOKIE)?.value;
  if (!slug) return null;
  return prisma.deliveryZone.findUnique({ where: { slug } });
}

export async function setZoneCookie(slug: string) {
  const store = await cookies();
  store.set(ZONE_COOKIE, slug, {
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Match coordinates to the nearest served zone whose radius contains them.
 * Returns null when the visitor is outside every served zone.
 *
 * accuracyM is how far off the phone says its fix may be: up to 1.5 km of
 * it is given as slack at a zone's edge, so someone on the boundary isn't
 * turned away because their phone placed them a street too far.
 */
export async function resolveZoneByCoords(lat: number, lng: number, accuracyM = 0) {
  const slackKm = Math.min(Math.max(accuracyM, 0) / 1000, 1.5);
  const zones = await prisma.deliveryZone.findMany({ where: { isServed: true } });
  let best: { zone: (typeof zones)[number]; dist: number } | null = null;

  for (const zone of zones) {
    if (zone.centerLat == null || zone.centerLng == null) continue;
    const dist = distanceKm(lat, lng, zone.centerLat, zone.centerLng);
    if (zone.radiusKm != null && dist > zone.radiusKm + slackKm) continue;
    if (!best || dist < best.dist) best = { zone, dist };
  }

  return best?.zone ?? null;
}
