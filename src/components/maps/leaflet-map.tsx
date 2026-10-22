"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/logistics/geo";

/*
 * One map for Logistics (and anywhere else that needs one): OpenStreetMap
 * tiles drawn with Leaflet. Pins are plain HTML (numbered stops, the depot),
 * so nothing loads from a third party but the tiles. Click to pick a point,
 * drag a pin to move it, and it fits itself to what's on it.
 */

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** Shown on hover. */
  label?: string;
  /** Text inside the pin: a stop number, "H" for the depot. */
  text?: string;
  color?: string;
  kind?: "depot" | "stop" | "pick";
  /** Faded: an approximate location. */
  faint?: boolean;
  draggable?: boolean;
};

export type MapLine = { id: string; points: [number, number][]; color: string; dashed?: boolean };

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type Leaflet = typeof import("leaflet");
type Drawn = { pins: MapPin[]; lines: MapLine[]; fit: boolean; onDrag?: (id: string, p: LatLng) => void };

/** Clear the layer and draw what's asked for; then fit the view to it. */
function paint(leaflet: Leaflet, m: import("leaflet").Map, g: import("leaflet").LayerGroup, { pins, lines, fit }: Drawn, latest: { current: Drawn & { onPick?: (p: LatLng) => void } }) {
  g.clearLayers();
  const bounds: [number, number][] = [];

  for (const ln of lines) {
    if (ln.points.length < 2) continue;
    leaflet.polyline(ln.points, { color: ln.color, weight: 5, opacity: 0.85, dashArray: ln.dashed ? "6 8" : undefined }).addTo(g);
    bounds.push(...ln.points);
  }
  for (const p of pins) {
    const depot = p.kind === "depot";
    const size = depot ? 30 : p.kind === "pick" ? 22 : 26;
    const html = `<div style="width:${size}px;height:${size}px;border-radius:${depot ? "8px" : "999px"};background:${p.color ?? (depot ? "#000" : "#0f7a48")};color:#fff;display:grid;place-items:center;font:700 12px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);opacity:${p.faint ? 0.55 : 1}">${p.text ?? ""}</div>`;
    const icon = leaflet.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    const mk = leaflet.marker([p.lat, p.lng], { icon, draggable: Boolean(p.draggable), title: p.label, keyboard: false }).addTo(g);
    if (p.label) mk.bindTooltip(p.label, { direction: "top", offset: [0, -size / 2] });
    if (p.draggable)
      mk.on("dragend", () => {
        const at = mk.getLatLng();
        latest.current.onDrag?.(p.id, { lat: at.lat, lng: at.lng });
      });
    bounds.push([p.lat, p.lng]);
  }
  if (fit && bounds.length > 1) m.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  else if (fit && bounds.length === 1) m.setView(bounds[0], Math.max(m.getZoom(), 14));
}

export function LeafletMap({
  center,
  zoom = 12,
  pins = [],
  lines = [],
  onPick,
  onDrag,
  fit = true,
  className = "h-[520px]",
}: {
  center: LatLng;
  zoom?: number;
  pins?: MapPin[];
  lines?: MapLine[];
  /** A click on the map, for choosing a point. */
  onPick?: (p: LatLng) => void;
  /** A pin dragged to a new place. */
  onDrag?: (id: string, p: LatLng) => void;
  /** Zoom to show every pin and line whenever they change. */
  fit?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const L = useRef<Leaflet | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  // What to draw and who to tell, as of the last render (read by the map's own event handlers).
  const latest = useRef<Drawn & { onPick?: (p: LatLng) => void }>({ pins, lines, fit, onPick, onDrag });
  useEffect(() => {
    latest.current = { pins, lines, fit, onPick, onDrag };
  });

  // The map itself, once. Leaflet touches `window`, so it loads in the browser only.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !box.current || map.current) return;
      const leaflet = (mod as unknown as { default?: Leaflet }).default ?? (mod as unknown as Leaflet);
      L.current = leaflet;
      const m = leaflet.map(box.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], zoom);
      // OpenStreetMap refuses tiles asked for with no Referer (the admin sends none by default),
      // so tiles alone send the site's origin: never the page's path.
      leaflet.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION, referrerPolicy: "strict-origin" }).addTo(m);
      m.on("click", (e) => latest.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      paint(leaflet, m, layer.current, latest.current, latest);
      // In a sheet or a resizing column the box changes size after Leaflet measured it.
      resize = new ResizeObserver(() => m.invalidateSize());
      resize.observe(box.current);
    });
    let resize: ResizeObserver | null = null;
    return () => {
      cancelled = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
    // The map is made once; pins and lines are redrawn below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever what's on the map changes.
  const signature = JSON.stringify([pins.map((p) => [p.id, p.lat, p.lng, p.text, p.color, p.faint, p.draggable]), lines.map((l) => [l.id, l.points.length, l.color, l.dashed, l.points[0], l.points[l.points.length - 1]])]);
  useEffect(() => {
    if (L.current && map.current && layer.current) paint(L.current, map.current, layer.current, latest.current, latest);
  }, [signature]);

  return <div ref={box} className={`relative z-0 w-full overflow-hidden rounded-2xl ring-1 ring-black/10 ${className}`} role="application" aria-label="Map" />;
}
