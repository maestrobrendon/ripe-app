"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card, Field, Input } from "../../_ui/kit";
import { receiveDelivery, recordWasteLines } from "./actions";

/*
 * Line-by-line entry for a delivery received or stock thrown away. Weighed
 * produce is entered in kg and sent in grams.
 */

export type ProductOption = { id: string; name: string; weighed: boolean; unit: string; category: string };
type Line = { key: number; productId: string; quantity: string; cost: string; bestBefore: string; reason: string };

const selectClass = "h-11 w-full rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";
const WASTE_REASONS = ["Bruised or damaged", "Past best-before", "Spoiled in storage", "Dropped or crushed", "Other"];
let seq = 0;
const blank = (): Line => ({ key: ++seq, productId: "", quantity: "", cost: "", bestBefore: "", reason: WASTE_REASONS[0] });

export function StockLines({ mode, products, suppliers }: { mode: "receive" | "waste"; products: ProductOption[]; suppliers?: { id: string; name: string }[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lines, setLines] = useState<Line[]>(() => [blank()]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const byId = new Map(products.map((p) => [p.id, p]));
  const categories = [...new Set(products.map((p) => p.category))];

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const toStock = (l: Line) => {
    const p = byId.get(l.productId);
    const n = Number(l.quantity);
    return p && n > 0 ? Math.round(p.weighed ? n * 1000 : n) : 0;
  };

  const submit = () => {
    const ready = lines.filter((l) => l.productId && toStock(l) > 0);
    if (!ready.length) return setNotice({ tone: "error", text: "Add at least one product with a quantity." });
    start(async () => {
      setNotice(null);
      const r =
        mode === "receive"
          ? await run(() =>
              receiveDelivery({
                supplierId: supplierId || null,
                note,
                lines: ready.map((l) => ({ productId: l.productId, quantity: toStock(l), unitCost: l.cost ? Math.round(Number(l.cost)) : null, bestBefore: l.bestBefore || null })),
              }),
            )
          : await run(() => recordWasteLines({ lines: ready.map((l) => ({ productId: l.productId, quantity: toStock(l), reason: l.reason })) }));
      if (r.ok) {
        setNotice({ tone: "success", text: mode === "receive" ? `Received ${r.data.lines} line(s). Stock is updated.` : `Recorded ${r.data.lines} line(s) of waste.` });
        setLines([blank()]);
        setNote("");
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      {mode === "receive" && (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="rcv-supplier">
              <select id="rcv-supplier" className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Not recorded</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note" htmlFor="rcv-note" hint="e.g. Mile 12 run, Tuesday">
              <Input id="rcv-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Card>
      )}

      <Card className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-4 py-2 font-semibold">Product</th>
                <th className="w-36 px-2 py-2 font-semibold">Quantity</th>
                {mode === "receive" ? (
                  <>
                    <th className="w-36 px-2 py-2 font-semibold">Cost each (₦)</th>
                    <th className="w-44 px-2 py-2 font-semibold">Best before</th>
                  </>
                ) : (
                  <th className="w-56 px-2 py-2 font-semibold">Why</th>
                )}
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {lines.map((l) => {
                const p = byId.get(l.productId);
                return (
                  <tr key={l.key}>
                    <td className="px-4 py-2">
                      <select aria-label="Product" className={selectClass} value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value })}>
                        <option value="">Choose…</option>
                        {categories.map((c) => (
                          <optgroup key={c} label={c.charAt(0) + c.slice(1).toLowerCase().replace("_", " ")}>
                            {products
                              .filter((x) => x.category === c)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <Input aria-label="Quantity" type="number" min={0} step={p?.weighed ? 0.1 : 1} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                        <span className="w-8 text-[12px] text-carbon/50">{p?.unit ?? ""}</span>
                      </div>
                    </td>
                    {mode === "receive" ? (
                      <>
                        <td className="px-2 py-2">
                          <Input
                            aria-label={`Cost per ${p?.weighed ? "kg" : "item"}`}
                            type="number"
                            min={0}
                            value={l.cost}
                            onChange={(e) => update(l.key, { cost: e.target.value })}
                            placeholder={p?.weighed ? "per kg" : "per item"}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input aria-label="Best before" type="date" value={l.bestBefore} onChange={(e) => update(l.key, { bestBefore: e.target.value })} />
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-2">
                        <select aria-label="Reason" className={selectClass} value={l.reason} onChange={(e) => update(l.key, { reason: e.target.value })}>
                          {WASTE_REASONS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-2 py-2 text-right">
                      {lines.length > 1 && (
                        <button type="button" aria-label="Remove line" className="h-9 w-9 rounded-lg text-carbon/50 hover:bg-soft-mist" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
          <Button type="button" size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, blank()])}>
            + Add a line
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "receive" ? "Receive into stock" : "Record waste"}
          </Button>
        </div>
      </Card>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
    </form>
  );
}
