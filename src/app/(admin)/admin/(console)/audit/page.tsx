import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import type { Prisma } from "@/generated/prisma/client";
import { Badge, Button, Card, Input, PageHeader } from "../../_ui/kit";
import { VerifyChain } from "./verify-chain";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;
const when = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Lagos" }).format(d);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 120) || undefined;

function tone(action: string): "neutral" | "good" | "bad" | "warn" {
  if (/forbidden|failed|locked|broken|suspended|removed|disabled/.test(action)) return "bad";
  if (/role_changed|invite|password|passkey|totp|recovery|step_up/.test(action)) return "warn";
  if (/success|verified|reactivated/.test(action)) return "good";
  return "neutral";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("security.audit_view");
  const sp = await searchParams;
  const action = one(sp.action);
  const actor = one(sp.actor)?.toLowerCase();
  const target = one(sp.target);
  const before = one(sp.before);
  const beforeSeq = before && /^\d{1,18}$/.test(before) ? BigInt(before) : undefined;

  const where: Prisma.AuditEventWhereInput = {
    ...(action && { action: { startsWith: action } }),
    ...(actor && { actorEmail: { contains: actor } }),
    ...(target && { targetId: target }),
    ...(beforeSeq !== undefined && { seq: { lt: beforeSeq } }),
  };
  const rows = await prisma.auditEvent.findMany({ where, orderBy: { seq: "desc" }, take: PAGE + 1 });
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);

  const query = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ action, actor, target, ...extra })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/audit?${s}` : "/audit";
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in, refusal and change in the admin, newest first. Each entry is chained to the one before it, so edited or deleted history shows up in the check."
        actions={<VerifyChain />}
      />

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-center" action="/audit">
          <Input name="action" placeholder="Action starts with, e.g. staff." defaultValue={action} aria-label="Action" />
          <Input name="actor" placeholder="Staff email contains" defaultValue={actor} aria-label="Staff email" />
          <Input name="target" placeholder="Target ID" defaultValue={target} aria-label="Target ID" />
          <Button type="submit" size="sm">
            Filter
          </Button>
          {(action || actor || target) && (
            <Link href="/audit" className="text-center text-[13px] font-semibold text-carbon/60 underline underline-offset-2">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-5 py-2.5 font-semibold">#</th>
                <th className="px-3 py-2.5 font-semibold">When (Lagos)</th>
                <th className="px-3 py-2.5 font-semibold">Who</th>
                <th className="px-3 py-2.5 font-semibold">What</th>
                <th className="px-5 py-2.5 font-semibold">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 align-top">
              {page.map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-3 font-mono text-[12px] text-carbon/45 tabular-nums">{e.seq.toString()}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-carbon/70 tabular-nums">{when(e.at)}</td>
                  <td className="px-3 py-3">
                    {e.actorEmail ? (
                      <Link href={query({ actor: e.actorEmail, before: undefined })} className="font-semibold hover:underline">
                        {e.actorEmail}
                      </Link>
                    ) : (
                      <span className="font-semibold">{e.actorType === "SYSTEM" ? "System" : "Unknown"}</span>
                    )}
                    {e.actorRole && <span className="block text-[12px] text-carbon/50">{e.actorRole.toLowerCase().replace(/_/g, " ")}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={tone(e.action)}>{e.action}</Badge>
                    {e.summary && <p className="mt-1 max-w-[440px] text-carbon/75">{e.summary}</p>}
                    {e.targetId && (
                      <Link href={query({ target: e.targetId, before: undefined })} className="mt-0.5 block font-mono text-[11px] text-carbon/45 hover:underline">
                        {e.targetType} {e.targetId}
                      </Link>
                    )}
                    {e.diff !== null && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[12px] text-carbon/55">Changes</summary>
                        <pre className="mt-1 max-w-[440px] overflow-x-auto rounded-lg bg-soft-mist/50 p-2 text-[11px]">{JSON.stringify(e.diff, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-carbon/55">
                    {e.ip ?? "—"}
                    {e.userAgent && <span className="block max-w-[220px] truncate" title={e.userAgent}>{e.userAgent}</span>}
                  </td>
                </tr>
              ))}
              {page.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-carbon/50">
                    Nothing matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 flex justify-between text-[13px] font-semibold">
        {beforeSeq !== undefined ? (
          <Link href={query({ before: undefined })} className="underline underline-offset-2">
            Newest
          </Link>
        ) : (
          <span />
        )}
        {more && (
          <Link href={query({ before: page[page.length - 1].seq.toString() })} className="underline underline-offset-2">
            Older
          </Link>
        )}
      </div>
    </>
  );
}
