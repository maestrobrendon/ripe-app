"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card, Field, Input, cx } from "../../_ui/kit";
import { saveStockGrid, type GridChange } from "./actions";

/*
 * The stock grid: a spreadsheet over every product. Edits don't save as you
 * type; they collect into a changeset, highlighted in the grid, and go to the
 * server together after a review, with a reason. The canvas grid itself
 * (Glide Data Grid) loads in the browser only.
 */

export type GridRowData = {
  id: string;
  name: string;
  category: string;
  weighed: boolean;
  unit: string;
  availability: string;
  /** Stock unit (grams for weighed produce). */
  onHand: number;
  committed: number;
  reorderPoint: number | null;
  costPrice: number | null;
  standardPrice: number;
  memberPrice: number;
  version: number;
  supplier: string | null;
};

export type EditableField = "onHand" | "reorderPoint" | "costPrice" | "standardPrice" | "memberPrice";
export type Changes = Record<string, Partial<Record<EditableField, number | null>>>;

const GlideGrid = dynamic(() => import("./glide-grid"), {
  ssr: false,
  loading: () => <div className="grid h-[70vh] place-items-center rounded-2xl bg-paper-white text-[13px] text-carbon/50">Loading the grid…</div>,
});

const FIELD_LABEL: Record<EditableField, string> = { onHand: "On hand", reorderPoint: "Reorder at", costPrice: "Cost", standardPrice: "Standard", memberPrice: "Member" };

/** A stored stock-unit value as shown to people (kg for weighed produce). */
export const show = (v: number | null, weighed: boolean) => (v === null ? null : weighed ? v / 1000 : v);

export function StockGrid({ rows, initialQuery, canAdjust, canPrice }: { rows: GridRowData[]; initialQuery: string; canAdjust: boolean; canPrice: boolean }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [changes, setChanges] = useState<Changes>({});
  const [query, setQuery] = useState(initialQuery);
  const [lowOnly, setLowOnly] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "warn"; text: string } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!lowOnly || (r.reorderPoint !== null && r.onHand <= r.reorderPoint) || r.onHand - r.committed < 0));
  }, [rows, query, lowOnly]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const changeList = Object.entries(changes).flatMap(([id, c]) =>
    (Object.keys(c) as EditableField[]).map((f) => ({ id, field: f, from: byId.get(id)![f], to: c[f] ?? null, row: byId.get(id)! })),
  );

  const edit = (id: string, field: EditableField, value: number | null) =>
    setChanges((prev) => {
      const row = byId.get(id)!;
      const next = { ...prev, [id]: { ...prev[id] } };
      // Editing back to the original value removes the change.
      if (value === row[field]) delete next[id][field];
      else next[id][field] = value;
      if (Object.keys(next[id]).length === 0) delete next[id];
      return next;
    });

  const save = () =>
    start(async () => {
      setNotice(null);
      const payload: GridChange[] = Object.entries(changes).map(([id, c]) => ({
        productId: id,
        version: byId.get(id)!.version,
        ...(c.onHand !== undefined && { onHand: c.onHand ?? 0 }),
        ...(c.reorderPoint !== undefined && { reorderPoint: c.reorderPoint }),
        ...(c.costPrice !== undefined && { costPrice: c.costPrice }),
        ...(c.standardPrice !== undefined && c.standardPrice !== null && { standardPrice: c.standardPrice }),
        ...(c.memberPrice !== undefined && c.memberPrice !== null && { memberPrice: c.memberPrice }),
      }));
      const r = await run(() => saveStockGrid({ changes: payload, reason }));
      if (r.ok) {
        setChanges({});
        setReviewing(false);
        setReason("");
        setNotice(
          r.data.skipped.length
            ? { tone: "warn", text: `Saved ${r.data.saved}. Not saved: ${r.data.skipped.join("; ")}. Their latest values are showing now; edit again if needed.` }
            : { tone: "success", text: `Saved ${r.data.saved} product${r.data.saved === 1 ? "" : "s"}.` },
        );
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });

  const fmt = (v: number | null, f: EditableField, weighed: boolean) =>
    v === null ? "—" : f === "onHand" || f === "reorderPoint" ? `${show(v, weighed)!.toLocaleString("en-NG", { maximumFractionDigits: 3 })}` : `₦${v.toLocaleString("en-NG")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name" aria-label="Filter products" className="max-w-xs" />
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low or short only
        </label>
        <span className="text-[13px] text-carbon/50">{visible.length} products</span>
        {!canAdjust && <span className="text-[13px] text-carbon/55">Read-only for your role.</span>}
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <GlideGrid rows={visible} changes={changes} onEdit={edit} canAdjust={canAdjust} canPrice={canPrice} />

      {changeList.length > 0 && (
        <div className="sticky bottom-4 z-20 rounded-2xl bg-carbon p-4 text-paper-white shadow-xl">
          {!reviewing ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] font-semibold">
                {changeList.length} change{changeList.length === 1 ? "" : "s"} on {Object.keys(changes).length} product{Object.keys(changes).length === 1 ? "" : "s"}, not saved yet
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-paper-white hover:bg-paper-white/10" onClick={() => setChanges({})}>
                  Discard
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setReviewing(true)}>
                  Review and save
                </Button>
              </div>
            </div>
          ) : (
            <ReviewPanel
              items={changeList.map((c) => ({ key: `${c.id}-${c.field}`, name: c.row.name, field: FIELD_LABEL[c.field], from: fmt(c.from, c.field, c.row.weighed), to: fmt(c.to, c.field, c.row.weighed), unit: c.field === "onHand" || c.field === "reorderPoint" ? c.row.unit : "" }))}
              reason={reason}
              setReason={setReason}
              pending={pending}
              onBack={() => setReviewing(false)}
              onSave={save}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewPanel(props: {
  items: { key: string; name: string; field: string; from: string; to: string; unit: string }[];
  reason: string;
  setReason: (v: string) => void;
  pending: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <Card className="bg-paper-white text-carbon">
      <p className="text-[15px] font-semibold">Review {props.items.length} change{props.items.length === 1 ? "" : "s"}</p>
      <div className="mt-3 max-h-64 overflow-y-auto">
        <table className="w-full text-left text-[13px]">
          <tbody className="divide-y divide-black/5">
            {props.items.map((i) => (
              <tr key={i.key}>
                <td className="py-1.5 pr-3 font-medium">{i.name}</td>
                <td className="py-1.5 pr-3 text-carbon/60">{i.field}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-carbon/50 line-through">{i.from}</td>
                <td className={cx("py-1.5 text-right font-semibold tabular-nums")}>
                  {i.to} <span className="font-normal text-carbon/50">{i.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave();
        }}
      >
        <div className="min-w-60 flex-1">
          <Field label="What is this?" htmlFor="grid-reason" hint="Recorded with every change, e.g. Monday morning stock count">
            <Input id="grid-reason" required minLength={3} maxLength={200} value={props.reason} onChange={(e) => props.setReason(e.target.value)} />
          </Field>
        </div>
        <Button type="button" variant="ghost" onClick={props.onBack}>
          Back to the grid
        </Button>
        <Button type="submit" disabled={props.pending || props.reason.trim().length < 3}>
          {props.pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
