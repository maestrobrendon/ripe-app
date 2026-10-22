import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/admin/guard";
import { demandSignals } from "@/lib/admin/insights";
import { Card, PageHeader } from "../../../_ui/kit";
import { BarList, Stat } from "../../../_ui/charts";
import { when } from "../../../_ui/format";

export const metadata: Metadata = { title: "Demand" };

export default async function DemandPage() {
  await requireStaffPage("insights.view");
  const d = await demandSignals(30);
  return (
    <>
      <PageHeader title="Demand" description="What people ask for that you don't do yet: areas, ingredients, and the recipes they keep. Last 30 days unless it says otherwise." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Asked for a new area" value={String(d.waitlistRecent)} note="Waitlist sign-ups" />
        <Stat label="Kachi chats started" value={String(d.kachi.threads)} />
        <Stat label="Messages to Kachi" value={String(d.kachi.messages)} />
        <Stat label="People using Kachi" value={String(d.kachi.users)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Areas people want (all time)">
          <BarList rows={d.waitlist.map((w) => ({ label: w.label, value: w.count }))} empty="No waitlist sign-ups yet." />
        </Card>
        <Card title="Ingredients asked for, not stocked">
          {d.unstocked.length === 0 ? (
            <p className="text-[13px] text-carbon/50">Nobody has asked for anything you don&apos;t stock yet.</p>
          ) : (
            <ul className="divide-y divide-black/5 text-[13px]">
              {d.unstocked.map((u) => (
                <li key={u.term} className="flex justify-between gap-3 py-2">
                  <span className="truncate capitalize">{u.term}</span>
                  <span className="shrink-0 text-carbon/55">
                    <b className="font-semibold text-carbon tabular-nums">{u.count}</b> · last {when(u.last)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Most-saved recipes">
          <BarList rows={d.saved.map((s) => ({ label: s.label, value: s.count }))} empty="No saved recipes yet." />
        </Card>
      </div>
    </>
  );
}
