import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { Badge, Card, PageHeader } from "../../_ui/kit";
import { daysAgo, naira, one, when } from "../../_ui/format";
import { RequestDecision } from "./request-decision";
import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = { title: "Memberships" };

const PAGE = 50;

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff } = await requireStaffPage("subscriptions.view");
  const role = staff.role as Role;
  const sp = await searchParams;
  const tierSlug = one(sp.tier, 60);
  const after = one(sp.after, 40);
  const monthAgo = daysAgo(30);

  const [tiers, pending, members, recent] = await Promise.all([
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: { where: { erasedAt: null } } } } } }),
    prisma.planRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { tier: true, user: { select: { id: true, name: true, subscriptionTier: { select: { name: true } } } } },
    }),
    prisma.user.findMany({
      where: { subscriptionTierId: { not: null }, erasedAt: null, ...(tierSlug && { subscriptionTier: { slug: tierSlug } }) },
      orderBy: [{ subscribedAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(after && { cursor: { id: after }, skip: 1 }),
      select: { id: true, name: true, subscribedAt: true, deliveryDay: true, subscriptionTier: { select: { name: true } } },
    }),
    prisma.auditEvent.findMany({
      where: { action: { in: ["plan.requested", "plan.changed", "plan.cancelled", "customers.plan_changed", "subscriptions.request_approved", "subscriptions.request_declined"] }, at: { gte: monthAgo } },
      orderBy: { seq: "desc" },
      take: 15,
      select: { id: true, at: true, action: true, summary: true, targetId: true, actorType: true },
    }),
  ]);
  const memberCount = tiers.reduce((s, t) => s + t._count.users, 0);
  const mrr = tiers.reduce((s, t) => s + t._count.users * t.monthlyFee, 0);
  const more = members.length > PAGE;
  const page = members.slice(0, PAGE);
  const canDecide = can(role, "subscriptions.manage");
  const canSeeCustomers = can(role, "customers.view");
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tier: tierSlug, ...extra })) if (v) p.set(k, v);
    return `/subscriptions?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Memberships"
        description="Who's on a paid plan, and requests waiting for payment to be confirmed. Until there's a payment gateway, a plan only starts when Finance approves it here."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Members", value: memberCount.toLocaleString("en-NG"), note: "On any paid plan" },
          { label: "Monthly membership revenue", value: naira(mrr), note: "If every member pays this month" },
          ...tiers.map((t) => ({ label: t.name, value: t._count.users.toLocaleString("en-NG"), note: `${naira(t.monthlyFee)} a month` })),
        ]
          .slice(0, 4)
          .map((s) => (
            <Card key={s.label} className="p-4!">
              <p className="text-[12px] font-semibold text-carbon/55">{s.label}</p>
              <p className="mt-1 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{s.value}</p>
              <p className="mt-1 text-[12px] text-carbon/45">{s.note}</p>
            </Card>
          ))}
      </div>

      <Card title={`Waiting for payment (${pending.length})`} className="mb-5">
        {pending.length === 0 ? (
          <p className="text-[13px] text-carbon/50">No requests waiting.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
                <div>
                  <p>
                    {canSeeCustomers ? (
                      <Link href={`/customers/${r.user.id}`} className="font-semibold hover:underline">
                        {r.user.name}
                      </Link>
                    ) : (
                      <b className="font-semibold">{r.user.name}</b>
                    )}{" "}
                    wants <b className="font-semibold">{r.tier.name}</b> ({naira(r.tier.monthlyFee)}/month)
                    {r.user.subscriptionTier && <span className="text-carbon/55">, now on {r.user.subscriptionTier.name}</span>}
                  </p>
                  <p className="text-[12px] text-carbon/50">Asked {when(r.createdAt)}</p>
                </div>
                {canDecide && <RequestDecision requestId={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="mb-5" aria-labelledby="plans-title">
        <h2 id="plans-title" className="mb-3 text-[15px] font-semibold">
          Plans
        </h2>
        <PlanEditor canManage={canDecide} tiers={tiers.map((t) => ({ slug: t.slug, name: t.name, monthlyFee: t.monthlyFee, tagline: t.tagline, perks: t.perks }))} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card
          title="Members"
          className="p-0! overflow-hidden"
          actions={
            <nav className="flex gap-1 pr-5 pt-5 text-[12px] font-semibold">
              <Link href={href({ tier: undefined, after: undefined })} className={tierSlug ? "text-carbon/50" : ""}>
                All
              </Link>
              {tiers.map((t) => (
                <Link key={t.slug} href={href({ tier: t.slug, after: undefined })} className={`ml-2 ${tierSlug === t.slug ? "" : "text-carbon/50"}`}>
                  {t.name}
                </Link>
              ))}
            </nav>
          }
        >
          <table className="w-full text-left text-[13px]">
            <tbody className="divide-y divide-black/5 border-t border-black/6">
              {page.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5">
                    {canSeeCustomers ? (
                      <Link href={`/customers/${m.id}`} className="font-semibold hover:underline">
                        {m.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{m.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone="good">{m.subscriptionTier?.name}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-carbon/60">Since {when(m.subscribedAt)}</td>
                </tr>
              ))}
              {page.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-carbon/50">No members yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          {more && (
            <div className="border-t border-black/6 px-5 py-3 text-right text-[13px] font-semibold">
              <Link href={href({ after: page[page.length - 1].id })} className="underline underline-offset-2">
                More
              </Link>
            </div>
          )}
        </Card>

        <Card title="Last 30 days">
          <ul className="space-y-2.5 text-[13px]">
            {recent.map((e) => (
              <li key={e.id}>
                <p>{e.summary}</p>
                <p className="text-[12px] text-carbon/50">
                  {e.actorType === "CUSTOMER" ? "By the customer" : "By staff"} · {when(e.at)}
                  {canSeeCustomers && e.targetId && (
                    <>
                      {" · "}
                      <Link href={`/customers/${e.targetId}`} className="underline">
                        customer
                      </Link>
                    </>
                  )}
                </p>
              </li>
            ))}
            {recent.length === 0 && <li className="text-carbon/50">No plan changes in the last 30 days.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
