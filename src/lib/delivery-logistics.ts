import "server-only";
import { cache } from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SUPPORT_EMAIL } from "@/lib/site";
import { geocode, priceDelivery, roadKm, travelTable, type GeocodeOptions, type LatLng, type PricingRules, type RoutingOptions } from "@/lib/logistics";

/*
 * Basket's side of the logistics engine (src/lib/logistics): the settings
 * staff set in Admin → Logistics, the delivery fee for an area or an
 * address, and locating addresses on the map.
 *
 * How a fee is worked out, when distance pricing is on:
 *   - an address with a pin the customer dropped: the road distance from the
 *     depot to that pin;
 *   - otherwise: the road distance from the depot to the middle of its area;
 *   - an area with no middle set: its flat fee from Delivery areas.
 * With distance pricing off, every fee is the area's flat fee, as before.
 *
 * Addresses found from their text (not pinned) are used for planning routes
 * only, never for the price, because a text match can be wrong.
 */

export const LOGISTICS_KEY = "logistics";

export const logisticsSchema = z.object({
  /** Price deliveries by distance (otherwise each area's flat fee). */
  enabled: z.boolean(),
  /** Where runs start: the hub or market. */
  depot: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: z.string().trim().max(120) }),
  rules: z.object({
    baseFee: z.number().int().min(0).max(100_000),
    perKm: z.number().int().min(0).max(10_000),
    includedKm: z.number().min(0).max(100),
    minFee: z.number().int().min(0).max(100_000),
    maxFee: z.number().int().min(0).max(1_000_000),
    roundTo: z.number().int().min(1).max(5_000),
  }),
  /** Lagos traffic: road times from the routing server are multiplied by this. */
  trafficFactor: z.number().min(1).max(4),
  /** Minutes spent at each stop (parking, handover, payment). */
  serviceMin: z.number().int().min(0).max(60),
  /** When runs leave, "09:00". */
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  /** Whether riders come back to the depot at the end. */
  returnToDepot: z.boolean(),
  /** Road km from the depot to the middle of each area, worked out when these settings are saved. */
  zoneKm: z.record(z.string(), z.number()),
});

export type LogisticsSettings = z.infer<typeof logisticsSchema>;

export const LOGISTICS_DEFAULTS: LogisticsSettings = {
  enabled: false,
  depot: { lat: 6.4474, lng: 3.4747, label: "Lekki Phase 1" },
  rules: { baseFee: 1000, perKm: 100, includedKm: 3, minFee: 1500, maxFee: 6000, roundTo: 100 },
  trafficFactor: 1.6,
  serviceMin: 6,
  startTime: "09:00",
  returnToDepot: false,
  zoneKm: {},
};

export const getLogistics = cache(async (): Promise<LogisticsSettings> => {
  const row = await prisma.siteSetting.findUnique({ where: { key: LOGISTICS_KEY } }).catch(() => null);
  const parsed = logisticsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : LOGISTICS_DEFAULTS;
});

/**
 * Where the engine finds roads. Times come back as free-flowing traffic (OSRM's, or the
 * estimate's ~30 km/h); callers multiply them by `trafficFactor` for Lagos.
 */
export const routingOptions = (): RoutingOptions => ({ baseUrl: process.env.OSRM_URL, roadFactor: 1.35, speedKmh: 30 });
export const geocodeOptions: GeocodeOptions = {
  userAgent: `Basket/1.0 (${SUPPORT_EMAIL})`,
  countryCodes: "ng",
  // Lagos, roughly: west, north, east, south.
  viewbox: [2.7, 6.75, 4.4, 6.35],
};

/* --------------------------------- fees --------------------------------- */

type ZoneLike = { id: string; deliveryFee: number };
type AddressLike = { geoSource?: string | null; distanceKm?: number | null };

export const priceFor = (km: number, s: LogisticsSettings) => priceDelivery(km, s.rules as PricingRules);

/** The delivery fee to an area (before an exact address is known). */
export function zoneFee(zone: ZoneLike, s: LogisticsSettings): number {
  if (!s.enabled) return zone.deliveryFee;
  const km = s.zoneKm[zone.id];
  return km == null ? zone.deliveryFee : priceFor(km, s).fee;
}

/** The delivery fee to an address: its own pin's distance when it has one, else its area's. */
export function addressFee(address: AddressLike, zone: ZoneLike, s: LogisticsSettings): number {
  if (s.enabled && address.geoSource === "PIN" && address.distanceKm != null) return priceFor(address.distanceKm, s).fee;
  return zoneFee(zone, s);
}

/* ------------------------------- locating ------------------------------- */

/** Road km from the depot to the middle of every area that has one, for area pricing. */
export async function zoneDistances(s: LogisticsSettings): Promise<Record<string, number>> {
  const zones = await prisma.deliveryZone.findMany({ where: { centerLat: { not: null }, centerLng: { not: null } }, select: { id: true, centerLat: true, centerLng: true } });
  if (!zones.length) return {};
  const table = await travelTable([s.depot, ...zones.map((z) => ({ lat: z.centerLat!, lng: z.centerLng! }))], routingOptions());
  return Object.fromEntries(zones.map((z, i) => [z.id, Math.round(table.km[0][i + 1] * 10) / 10]));
}

/** Put an address on the map from what the customer pinned: exact, so it sets their price. */
export async function pinAddress(addressId: string, p: LatLng) {
  const s = await getLogistics();
  const { km } = await roadKm(s.depot, p, routingOptions());
  return prisma.address.update({ where: { id: addressId }, data: { lat: p.lat, lng: p.lng, geoSource: "PIN", distanceKm: Math.round(km * 10) / 10, geocodedAt: new Date() } });
}

/** Best-effort: find an address from its text, for planning routes. Never changes its price. */
export async function locateFromText(text: string, area: string): Promise<LatLng | null> {
  const hits = await geocode(`${text}, ${area}, Lagos, Nigeria`, geocodeOptions);
  return hits[0] ? { lat: hits[0].lat, lng: hits[0].lng } : null;
}
