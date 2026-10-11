"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card, Field, Input } from "../../_ui/kit";
import { saveTier } from "../settings/actions";

type Tier = { slug: string; name: string; monthlyFee: number; tagline: string; perks: string[] };

/** The paid plans as customers see them on the pricing page. */
export function PlanEditor({ tiers, canManage }: { tiers: Tier[]; canManage: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {tiers.map((t) => (
        <PlanCard key={t.slug} tier={t} canManage={canManage} />
      ))}
    </div>
  );
}

function PlanCard({ tier, canManage }: { tier: Tier; canManage: boolean }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const save = (f: FormData, confirmLargeChange = false) =>
    start(async () => {
      setNotice(null);
      const input = {
        slug: tier.slug,
        name: String(f.get("name") ?? ""),
        monthlyFee: Math.round(Number(f.get("fee"))),
        tagline: String(f.get("tagline") ?? ""),
        perks: String(f.get("perks") ?? "")
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        confirmLargeChange,
      };
      const r = await run(() => saveTier(input));
      if (r.ok) {
        setNotice({ tone: "success", text: "Saved. The pricing page shows it now." });
        router.refresh();
      } else if (r.code === "CONFLICT" && !confirmLargeChange) {
        if (window.confirm(`${r.error} That's a big change. Save it anyway?`)) save(f, true);
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });

  return (
    <Card title={tier.name}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save(new FormData(e.currentTarget));
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor={`t-name-${tier.slug}`}>
            <Input id={`t-name-${tier.slug}`} name="name" required maxLength={40} defaultValue={tier.name} disabled={!canManage} />
          </Field>
          <Field label="Monthly fee (₦)" htmlFor={`t-fee-${tier.slug}`}>
            <Input id={`t-fee-${tier.slug}`} name="fee" type="number" min={0} required defaultValue={tier.monthlyFee} disabled={!canManage} />
          </Field>
        </div>
        <Field label="Tagline" htmlFor={`t-tag-${tier.slug}`}>
          <Input id={`t-tag-${tier.slug}`} name="tagline" required maxLength={200} defaultValue={tier.tagline} disabled={!canManage} />
        </Field>
        <Field label="Perks" htmlFor={`t-perks-${tier.slug}`} hint="One per line, as they appear on the pricing page.">
          <textarea
            id={`t-perks-${tier.slug}`}
            name="perks"
            rows={6}
            required
            disabled={!canManage}
            defaultValue={tier.perks.join("\n")}
            className="w-full rounded-xl bg-paper-white p-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]"
          />
        </Field>
        {canManage && (
          <Button size="sm" disabled={pending}>
            Save plan
          </Button>
        )}
        <p className="text-[12px] text-carbon/50">A fee change applies to requests from now on. Members already on the plan aren&apos;t charged by the site; Finance handles payments.</p>
      </form>
      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Card>
  );
}
