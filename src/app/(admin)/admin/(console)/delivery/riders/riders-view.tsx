"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../../step-up";
import { Alert, Badge, Button, Card, Field, Input } from "../../../_ui/kit";
import { saveRider } from "../actions";

type Rider = { id: string; name: string; phone: string; notes: string; active: boolean; runs: number };

export function RidersView({ canManage, riders }: { canManage: boolean; riders: Rider[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Rider | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <Card title={`Riders (${riders.length})`} actions={canManage ? <Button size="sm" onClick={() => setEditing("new")}>Add rider</Button> : undefined}>
        <ul className="divide-y divide-black/5">
          {riders.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <div>
                <p className="font-semibold">
                  {r.name} {!r.active && <Badge>Not riding</Badge>}
                </p>
                <p className="text-carbon/55">
                  {r.phone} · {r.runs} run{r.runs === 1 ? "" : "s"}
                  {r.notes && ` · ${r.notes}`}
                </p>
              </div>
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                  Edit
                </Button>
              )}
            </li>
          ))}
          {riders.length === 0 && <li className="py-3 text-[13px] text-carbon/50">No riders yet.</li>}
        </ul>
      </Card>

      {editing && (
        <Card title={editing === "new" ? "New rider" : `Edit ${editing.name}`}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                setNotice(null);
                const r = await run(() =>
                  saveRider({
                    ...(editing !== "new" && { id: editing.id }),
                    name: String(f.get("name") ?? ""),
                    phone: String(f.get("phone") ?? ""),
                    notes: String(f.get("notes") ?? ""),
                    active: f.get("active") === "on",
                  }),
                );
                if (r.ok) {
                  setEditing(null);
                  router.refresh();
                } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
              });
            }}
          >
            <Field label="Name" htmlFor="rider-name">
              <Input id="rider-name" name="name" required maxLength={80} defaultValue={editing === "new" ? "" : editing.name} />
            </Field>
            <Field label="Phone" htmlFor="rider-phone">
              <Input id="rider-phone" name="phone" required maxLength={32} inputMode="tel" defaultValue={editing === "new" ? "" : editing.phone} />
            </Field>
            <Field label="Notes" htmlFor="rider-notes">
              <Input id="rider-notes" name="notes" maxLength={300} placeholder="e.g. Covers Lekki and Ajah" defaultValue={editing === "new" ? "" : editing.notes} />
            </Field>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="active" defaultChecked={editing === "new" ? true : editing.active} /> Available for runs
            </label>
            <div className="flex gap-2">
              <Button size="sm" disabled={pending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          </form>
        </Card>
      )}
    </div>
  );
}
