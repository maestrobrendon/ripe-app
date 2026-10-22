"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { formatQty } from "@/lib/stock-core";
import { useAdminAction } from "../../step-up";
import { Alert, Button, Card, Field, Input } from "../../../_ui/kit";
import { importCounts } from "../actions";

type Product = { slug: string; name: string; weighed: boolean; onHand: number };
type Row = { slug: string; name: string; from: number; to: number; weighed: boolean };

/**
 * Reads a CSV with a `slug` column and an `on_hand` (or `count`) column,
 * shows what would change, and applies it as a stock count. The exported
 * file works as-is: edit on_hand and bring it back.
 */
export function ImportCounts({ products }: { products: Product[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const read = (file: File) => {
    setNotice(null);
    setRows(null);
    if (file.size > 2 * 1024 * 1024) return setNotice({ tone: "error", text: "That file is over 2 MB. A stock sheet should be far smaller." });
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (res) => {
        const out: Row[] = [];
        const bad: string[] = [];
        res.data.forEach((r, i) => {
          const slug = (r.slug ?? "").trim().toLowerCase();
          const raw = (r.on_hand ?? r.count ?? "").trim().replace(/,/g, "");
          if (!slug && !raw) return;
          const p = bySlug.get(slug);
          const n = Number(raw);
          if (!p) return bad.push(`Row ${i + 2}: "${slug || "(blank)"}" isn't a product`);
          if (raw === "" || !Number.isFinite(n) || n < 0) return bad.push(`Row ${i + 2}: ${p.name} needs a count of zero or more`);
          const to = Math.round(p.weighed ? n * 1000 : n);
          if (to !== p.onHand) out.push({ slug, name: p.name, from: p.onHand, to, weighed: p.weighed });
        });
        if (out.length > 500) bad.push("More than 500 changed rows; split the file.");
        setProblems(bad);
        setRows(out);
      },
      error: () => setNotice({ tone: "error", text: "That file couldn't be read as a CSV." }),
    });
  };

  const apply = () =>
    start(async () => {
      if (!rows?.length) return;
      const r = await run(() => importCounts({ rows: rows.map((x) => ({ slug: x.slug, counted: x.to })), reason }));
      if (r.ok) {
        setNotice({ tone: "success", text: `Applied. ${r.data.applied} product${r.data.applied === 1 ? "" : "s"} changed.` });
        setRows(null);
        setReason("");
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });

  return (
    <Card title="Import counts">
      <p className="text-[13px] text-carbon/65">
        Use the exported file: change the <b>on_hand</b> column to what you counted and upload it. Only rows that differ change. Weighed produce in kg.
      </p>
      <label className="mt-3 inline-flex h-9 cursor-pointer items-center rounded-xl px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] hover:bg-soft-mist/60">
        Choose a CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) read(f);
          }}
        />
      </label>

      {problems.length > 0 && (
        <div className="mt-3">
          <Alert tone="warn">
            {problems.length} row{problems.length === 1 ? "" : "s"} skipped: {problems.slice(0, 5).join("; ")}
            {problems.length > 5 && "…"}
          </Alert>
        </div>
      )}

      {rows && (
        <div className="mt-4">
          {rows.length === 0 ? (
            <p className="text-[13px] text-carbon/55">Every count matches what&apos;s recorded. Nothing to change.</p>
          ) : (
            <>
              <p className="text-[13px] font-semibold">
                {rows.length} count{rows.length === 1 ? "" : "s"} will change
              </p>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
                <table className="w-full text-left text-[13px]">
                  <tbody className="divide-y divide-black/5">
                    {rows.map((r) => (
                      <tr key={r.slug}>
                        <td className="px-3 py-1.5 font-medium">{r.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-carbon/50 line-through">{formatQty(r.from, r.weighed ? "WEIGHT" : "SINGLE")}</td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatQty(r.to, r.weighed ? "WEIGHT" : "SINGLE")}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${r.to < r.from ? "text-[#9a2c00]" : "text-[#0b5a35]"}`}>
                          {r.to > r.from ? "+" : ""}
                          {formatQty(r.to - r.from, r.weighed ? "WEIGHT" : "SINGLE")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form
                className="mt-3 flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  apply();
                }}
              >
                <div className="min-w-60 flex-1">
                  <Field label="What count is this?" htmlFor="imp-reason">
                    <Input id="imp-reason" required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Friday full count" />
                  </Field>
                </div>
                <Button disabled={pending || reason.trim().length < 3 || rows.length > 500}>{pending ? "Applying…" : "Apply counts"}</Button>
              </form>
            </>
          )}
        </div>
      )}
      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Card>
  );
}
