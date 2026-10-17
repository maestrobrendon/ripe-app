"use client";

import { useState } from "react";
import { useAdminAction } from "../../step-up";
import { Alert, Button, Card, Field, Input } from "../../../_ui/kit";

const KINDS = [
  { kind: "orders", title: "Orders", hint: "One row per order: dates, status, area, totals, refunds and payment.", dated: true },
  { kind: "refunds", title: "Refunds and credits", hint: "Everything paid back, how, why and by whom.", dated: true },
  { kind: "products", title: "Sales by product", hint: "Quantity, orders and revenue per product (paid orders).", dated: true },
  { kind: "members", title: "Members", hint: "Who's on which plan and since when, for matching plan payments. Names only.", dated: false },
] as const;

/** Each export asks for a fresh second factor first (a HEAD check), then downloads as a file. */
export function ExportCards({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const run = useAdminAction();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [error, setError] = useState<string | null>(null);

  const download = async (kind: string, dated: boolean) => {
    setError(null);
    const url = `/insights/export/${kind}${dated ? `?from=${from}&to=${to}` : ""}`;
    const r = await run(async () => {
      const res = await fetch(url, { method: "HEAD", credentials: "same-origin" });
      if (res.status === 428) return { ok: false as const, code: "STEP_UP" as const, error: "Confirm it's you" };
      if (res.status === 429) return { ok: false as const, code: "RATE_LIMIT" as const, error: "Too many downloads in the last hour. Try again later." };
      if (!res.ok) return { ok: false as const, code: "FORBIDDEN" as const, error: "Your role can't download reports." };
      return { ok: true as const, data: undefined };
    });
    if (!r.ok) {
      if (r.code !== "AUTH" && r.code !== "STEP_UP") setError(r.error);
      return;
    }
    // A real link click, so the browser saves the file.
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  };

  return (
    <div className="space-y-5">
      <Card title="Period">
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Field label="From" htmlFor="exp-from">
            <Input id="exp-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="exp-to">
            <Input id="exp-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-[12px] text-carbon/50">Lagos days, both ends included. Up to about a year per file.</p>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        {KINDS.map((k) => (
          <Card key={k.kind} title={k.title}>
            <p className="text-[13px] text-carbon/65">{k.hint}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => download(k.kind, k.dated)}>
              Download CSV{k.dated ? "" : " (as of now)"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
