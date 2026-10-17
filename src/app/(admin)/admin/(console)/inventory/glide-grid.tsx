"use client";

import "@glideapps/glide-data-grid/dist/index.css";
import { useCallback, useMemo, useState } from "react";
import { DataEditor, GridCellKind, type GridCell, type GridColumn, type Item, type EditableGridCell, type Theme } from "@glideapps/glide-data-grid";
import { show, type Changes, type EditableField, type GridRowData } from "./stock-grid";

/*
 * The canvas grid (Glide Data Grid). Keyboard navigation, copy, paste from
 * Excel and the fill handle all come with it; every edit is routed to
 * onEdit, which only records it in the changeset. Nothing saves from here.
 */

type Col = { id: string; title: string; width: number; field?: EditableField; price?: boolean; get: (r: GridRowData) => number | string | null };

const COLUMNS: Col[] = [
  { id: "name", title: "Product", width: 230, get: (r) => r.name },
  { id: "unit", title: "Unit", width: 58, get: (r) => r.unit },
  { id: "onHand", title: "On hand", width: 92, field: "onHand", get: (r) => show(r.onHand, r.weighed) },
  { id: "committed", title: "Promised", width: 92, get: (r) => show(r.committed, r.weighed) },
  { id: "free", title: "Free to sell", width: 100, get: (r) => show(r.onHand - r.committed, r.weighed) },
  { id: "reorder", title: "Reorder at", width: 96, field: "reorderPoint", get: (r) => show(r.reorderPoint, r.weighed) },
  { id: "cost", title: "Cost ₦", width: 90, field: "costPrice", price: true, get: (r) => r.costPrice },
  { id: "standard", title: "Standard ₦", width: 104, field: "standardPrice", price: true, get: (r) => r.standardPrice },
  { id: "member", title: "Member ₦", width: 98, field: "memberPrice", price: true, get: (r) => r.memberPrice },
  { id: "supplier", title: "Supplier", width: 150, get: (r) => r.supplier ?? "" },
  { id: "availability", title: "Availability", width: 120, get: (r) => r.availability.replace(/_/g, " ").toLowerCase() },
];

const STOCK_FIELDS: EditableField[] = ["onHand", "reorderPoint"];

export default function GlideGrid({
  rows,
  changes,
  onEdit,
  canAdjust,
  canPrice,
}: {
  rows: GridRowData[];
  changes: Changes;
  onEdit: (id: string, field: EditableField, value: number | null) => void;
  canAdjust: boolean;
  canPrice: boolean;
}) {
  // Canvas text can't read CSS variables, so use the page's resolved font.
  // This component only ever renders in the browser (loaded with ssr: false).
  const [font] = useState(() => getComputedStyle(document.body).fontFamily || "system-ui, sans-serif");

  const theme: Partial<Theme> = useMemo(
    () => ({
      accentColor: "#151515",
      accentLight: "rgba(155, 240, 196, 0.35)",
      textDark: "#151515",
      textMedium: "rgba(21,21,21,0.6)",
      textLight: "rgba(21,21,21,0.4)",
      textHeader: "rgba(21,21,21,0.6)",
      bgHeader: "#f2f4f1",
      bgHeaderHovered: "#e9ece7",
      borderColor: "rgba(0,0,0,0.06)",
      headerFontStyle: "600 12px",
      baseFontStyle: "13px",
      fontFamily: font,
    }),
    [font],
  );

  const editable = useCallback((c: Col) => Boolean(c.field) && (c.price ? canPrice : canAdjust && STOCK_FIELDS.includes(c.field!)), [canAdjust, canPrice]);

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const c = COLUMNS[col];
      const r = rows[row];
      if (!c.field) {
        const v = c.get(r);
        if (typeof v === "number") {
          const short = c.id === "free" && v < 0;
          return {
            kind: GridCellKind.Number,
            data: v,
            displayData: v.toLocaleString("en-NG", { maximumFractionDigits: 3 }),
            allowOverlay: false,
            readonly: true,
            ...(short && { themeOverride: { textDark: "#9a2c00" } }),
          };
        }
        return { kind: GridCellKind.Text, data: String(v ?? ""), displayData: String(v ?? ""), allowOverlay: false, readonly: true };
      }
      const pending = changes[r.id]?.[c.field];
      const stored = pending !== undefined ? pending : (r[c.field] as number | null);
      const shown = c.price ? stored : show(stored, r.weighed);
      const low = c.field === "onHand" && r.reorderPoint !== null && r.onHand <= r.reorderPoint;
      const can = editable(c);
      return {
        kind: GridCellKind.Number,
        data: shown ?? undefined,
        displayData: shown === null ? "" : shown.toLocaleString("en-NG", { maximumFractionDigits: 3 }),
        allowOverlay: can,
        readonly: !can,
        allowNegative: false,
        ...(pending !== undefined
          ? { themeOverride: { bgCell: "#fff1b8", textDark: "#151515" } }
          : low
            ? { themeOverride: { textDark: "#9a2c00" } }
            : !can
              ? { themeOverride: { textDark: "rgba(21,21,21,0.55)" } }
              : {}),
      };
    },
    [rows, changes, editable],
  );

  const onCellEdited = useCallback(
    ([col, row]: Item, value: EditableGridCell) => {
      const c = COLUMNS[col];
      const r = rows[row];
      if (!c.field || !editable(c) || value.kind !== GridCellKind.Number) return;
      const n = value.data;
      if (n === undefined || n === null || Number.isNaN(n)) {
        // Clearing is only meaningful where "none" is allowed.
        if (c.field === "reorderPoint" || c.field === "costPrice") onEdit(r.id, c.field, null);
        return;
      }
      if (n < 0) return;
      const stored = c.price ? Math.round(n) : r.weighed ? Math.round(n * 1000) : Math.round(n);
      if ((c.field === "standardPrice" || c.field === "memberPrice") && stored < 1) return;
      onEdit(r.id, c.field, stored);
    },
    [rows, onEdit, editable],
  );

  const columns: GridColumn[] = useMemo(
    () => COLUMNS.map((c) => ({ id: c.id, title: c.title, width: c.width, ...(editable(c) ? {} : { themeOverride: { bgHeader: "#f6f7f5" } }) })),
    [editable],
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-paper-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <DataEditor
        columns={columns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        getCellsForSelection
        onPaste
        fillHandle
        freezeColumns={1}
        rowMarkers="number"
        smoothScrollX
        smoothScrollY
        theme={theme}
        width="100%"
        height="70vh"
        rowHeight={34}
        headerHeight={36}
      />
      {/* Glide renders its cell editor into this element. */}
      <div id="portal" className="fixed top-0 left-0 z-[70]" />
    </div>
  );
}
