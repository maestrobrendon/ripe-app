/*
 * The logistics engine: distance pricing, road routing, address lookup and
 * multi-vehicle route planning. Nothing in this folder imports from the rest
 * of the app (no database, no Basket types), so it can be lifted out and
 * shipped on its own. Basket's glue lives in src/lib/delivery-logistics.ts.
 *
 * Built on free, open data: OpenStreetMap (maps), OSRM (roads) and Nominatim
 * (addresses).
 */

export * from "./geo";
export * from "./pricing";
export * from "./optimize";
export * from "./routing";
export * from "./geocode";
