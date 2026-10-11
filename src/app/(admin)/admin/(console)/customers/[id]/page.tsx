import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { maskAddress, maskEmail, maskPhone } from "@/lib/admin/pii";
import { STATUS_LABEL } from "@/lib/order-status";
import { DELIVERY_DAY_LABEL } from "@/lib/format";
import { Badge, Card, PageHeader } from "../../../_ui/kit";
import { dayDate, naira, orderRef, statusTone, when } from "../../../_ui/format";
import { AccountControls, ContactCard, DataControls, NotesCard, PlanCard } from "./customer-panels";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await requireStaffPage("customers.view");
  const role = staff.role as Role;
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id: id.slice(0, 40) },
    include: {
      subscriptionTier: true,
      deliveryZone: { select: { name: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, createdAt: true, deliveryDate: true, total: true, status: true, orderType: true } },
      baskets: { select: { id: true, isStanding: true, deliveryDay: true, isFreeTrial: true, _count: { select: { items: true } } } },
      notes: { orderBy: { createdAt: "desc" }, take: 50 },
      credits: { orderBy: { createdAt: "desc" }, take: 20 },
      planRequests: { where: { status: "PENDING" }, include: { tier: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { orders: true, sessions: true, assistantThreads: true, savedRecipes: true } },
    },
  });
  if (!user) notFound();

  const [spend, tiers] = await Promise.all([
    prisma.order.aggregate({ where: { userId: user.id, paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { total: true } }),
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, monthlyFee: true } }),
  ]);
  const erased = Boolean(user.erasedAt);

  return (
    <>
      <PageHeader
        title={user.name}
        description={
          <>
            Customer since {when(user.createdAt)}
            {user.deliveryZone && ` · ${user.deliveryZone.name}`} · {user._count.orders} order{user._count.orders === 1 ? "" : "s"} ·{" "}
            {naira(spend._sum.total ?? 0)} spent
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {user.subscriptionTier ? <Badge tone="good">{user.subscriptionTier.name}</Badge> : <Badge>Pay as you go</Badge>}
            {user.suspendedAt && <Badge tone="bad">Paused</Badge>}
            {erased && <Badge tone="bad">Erased</Badge>}
          </div>
        }
      />

      {user.suspendedAt && (
        <p className="mb-5 rounded-xl bg-ember/10 px-4 py-3 text-[13px] text-[#9a2c00]">
          Paused {when(user.suspendedAt)}: {user.suspendedReason}. They can&apos;t sign in.
        </p>
      )}
      {erased && (
        <p className="mb-5 rounded-xl bg-soft-mist px-4 py-3 text-[13px]">
          Personal data erased on request, {when(user.erasedAt)}. Orders are kept for the accounts without names or contact details.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card title="Orders" actions={user._count.orders > 20 && can(role, "orders.view") ? <Link href={`/orders?status=all&customer=${user.id}`} className="text-[13px] font-semibold underline">See all</Link> : undefined} className="p-0! overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-black/5 border-t border-black/6">
                {user.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-2.5">
                      {can(role, "orders.view") ? (
                        <Link href={`/orders/${o.id}`} className="font-mono font-semibold hover:underline">
                          {orderRef(o.id)}
                        </Link>
                      ) : (
                        <span className="font-mono font-semibold">{orderRef(o.id)}</span>
                      )}
                      <span className="block text-[12px] text-carbon/50">{when(o.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2.5">{dayDate(o.deliveryDate)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{naira(o.total)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>
                    </td>
                  </tr>
                ))}
                {user.orders.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-center text-carbon/50">No orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <NotesCard
            userId={user.id}
            canAdd={can(role, "customers.notes") && !erased}
            notes={user.notes.map((n) => ({ id: n.id, body: n.body, staffName: n.staffName, at: when(n.createdAt) }))}
          />

          {user.credits.length > 0 && (
            <Card title="Refunds and credits">
              <ul className="space-y-1.5 text-[13px]">
                {user.credits.map((c) => (
                  <li key={c.id}>
                    <b className="font-semibold">{naira(c.amount)}</b> {c.kind === "REFUND" ? "refunded" : "credited"} by {c.method}, {when(c.createdAt)}: {c.reason}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <ContactCard
            userId={user.id}
            masked={{ email: maskEmail(user.email), phone: maskPhone(user.phone), address: maskAddress(user.address) }}
            canReveal={can(role, "customers.reveal_pii") && !erased}
          />

          <PlanCard
            userId={user.id}
            current={user.subscriptionTier ? { slug: user.subscriptionTier.slug, name: user.subscriptionTier.name, since: user.subscribedAt ? when(user.subscribedAt) : null } : null}
            deliveryDay={user.deliveryDay ? DELIVERY_DAY_LABEL[user.deliveryDay] : null}
            tiers={tiers.map((t) => ({ slug: t.slug, label: `${t.name} (${naira(t.monthlyFee)}/month)` }))}
            requests={user.planRequests.map((r) => ({ id: r.id, tierName: r.tier.name, fee: naira(r.tier.monthlyFee), at: when(r.createdAt) }))}
            canChange={can(role, "customers.plan") && !erased}
            canDecide={can(role, "subscriptions.manage") && !erased}
          />

          <Card title="Activity">
            <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-carbon/50">Baskets</dt>
              <dd>
                {user.baskets.length}
                {user.baskets.find((b) => b.isStanding) && `, standing on ${DELIVERY_DAY_LABEL[user.baskets.find((b) => b.isStanding)!.deliveryDay]}`}
              </dd>
              <dt className="text-carbon/50">Saved recipes</dt>
              <dd>{user._count.savedRecipes}</dd>
              <dt className="text-carbon/50">Kachi chats</dt>
              <dd>{user._count.assistantThreads}</dd>
              <dt className="text-carbon/50">Signed in on</dt>
              <dd>
                {user._count.sessions} device{user._count.sessions === 1 ? "" : "s"}
              </dd>
            </dl>
          </Card>

          {!erased && (
            <AccountControls
              userId={user.id}
              suspended={Boolean(user.suspendedAt)}
              hasEmail={Boolean(user.email)}
              sessions={user._count.sessions}
              canManage={can(role, "customers.manage")}
            />
          )}

          <DataControls userId={user.id} name={user.name} erased={erased} canExport={can(role, "customers.export")} canErase={can(role, "customers.erase")} />
        </div>
      </div>
    </>
  );
}
