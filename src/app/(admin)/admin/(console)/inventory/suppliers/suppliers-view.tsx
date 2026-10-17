"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/guard";
import { useAdminAction } from "../../step-up";
import { Alert, Badge, Button, Card, Field, Input } from "../../../_ui/kit";
import { saveSupplier, setProductSupplier } from "../actions";

type Supplier = { id: string; name: string; phone: string; market: string; notes: string; active: boolean; products: number };
const selectClass = "h-9 w-full rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

export function SuppliersView({ canManage, suppliers, products }: { canManage: boolean; suppliers: Supplier[]; products: { id: string; name: string; supplierId: string | null }[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const go = (fn: () => Promise<ActionResult>, ok: string, then?: () => void) =>
    start(async () => {
      setNotice(null);
      const r = await run(fn);
      if (r.ok) {
        setNotice({ tone: "success", text: ok });
        then?.();
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Card title={`Suppliers (${suppliers.length})`} actions={canManage ? <Button size="sm" onClick={() => setEditing("new")}>Add supplier</Button> : undefined}>
          <ul className="divide-y divide-black/5">
            {suppliers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <p className="font-semibold">
                    {s.name} {!s.active && <Badge>Not used</Badge>}
                  </p>
                  <p className="text-carbon/55">{[s.market, s.phone, `${s.products} product${s.products === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
                  {s.notes && <p className="mt-0.5 text-carbon/65">{s.notes}</p>}
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                )}
              </li>
            ))}
            {suppliers.length === 0 && <li className="py-3 text-[13px] text-carbon/50">No suppliers yet.</li>}
          </ul>
        </Card>

        {editing && (
          <Card title={editing === "new" ? "New supplier" : `Edit ${editing.name}`}>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                go(
                  () =>
                    saveSupplier({
                      ...(editing !== "new" && { id: editing.id }),
                      name: String(f.get("name") ?? ""),
                      phone: String(f.get("phone") ?? ""),
                      market: String(f.get("market") ?? ""),
                      notes: String(f.get("notes") ?? ""),
                      active: f.get("active") === "on",
                    }),
                  "Supplier saved.",
                  () => setEditing(null),
                );
              }}
            >
              <Field label="Name" htmlFor="sup-name">
                <Input id="sup-name" name="name" required maxLength={80} defaultValue={editing === "new" ? "" : editing.name} />
              </Field>
              <Field label="Phone" htmlFor="sup-phone">
                <Input id="sup-phone" name="phone" maxLength={32} defaultValue={editing === "new" ? "" : editing.phone} />
              </Field>
              <Field label="Market" htmlFor="sup-market">
                <Input id="sup-market" name="market" maxLength={80} placeholder="e.g. Mile 12" defaultValue={editing === "new" ? "" : editing.market} />
              </Field>
              <Field label="Notes" htmlFor="sup-notes">
                <Input id="sup-notes" name="notes" maxLength={500} defaultValue={editing === "new" ? "" : editing.notes} />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="active" defaultChecked={editing === "new" ? true : editing.active} /> Still buying from them
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button size="sm" disabled={pending}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <Card title="Where each product comes from">
        <ul className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
          {products.map((p) => (
            <li key={p.id} className="grid grid-cols-[1fr_160px] items-center gap-2 text-[13px]">
              <span className="truncate">{p.name}</span>
              <select
                aria-label={`Supplier for ${p.name}`}
                className={selectClass}
                disabled={!canManage || pending}
                defaultValue={p.supplierId ?? ""}
                onChange={(e) => go(() => setProductSupplier({ productId: p.id, supplierId: e.target.value || null }), `${p.name} updated.`)}
              >
                <option value="">—</option>
                {suppliers
                  .filter((s) => s.active || s.id === p.supplierId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
