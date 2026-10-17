import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { maskEmail, maskPhone } from "@/lib/admin/pii";
import type { Prisma } from "@/generated/prisma/client";
import { Badge, Button, Card, Input, PageHeader } from "../../_ui/kit";
import { one, when } from "../../_ui/format";

export const metadata: Metadata = { title: "Customers" };

const PAGE = 50;
const selectClass = "h-11 rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("customers.view");
  const sp = await searchParams;
  const q = one(sp.q, 80);
  const plan = one(sp.plan, 60);
  const state = one(sp.state, 20);
  const after = one(sp.after, 40);

  const digits = q?.replace(/\D/g, "") ?? "";
  const where: Prisma.UserWhereInput = {
    ...(plan === "none" ? { subscriptionTierId: null } : plan ? { subscriptionTier: { slug: plan } } : {}),
    ...(state === "suspended" ? { suspendedAt: { not: null } } : state === "erased" ? { erasedAt: { not: null } } : { erasedAt: null }),
    // Contact search matches whole values only (an exact email, or a phone's
    // last digits), so it finds the person in front of you without letting
    // anyone browse addresses by fragment.
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(q.includes("@") ? [{ email: { equals: q.toLowerCase() } }] : []),
        ...(digits.length >= 7 ? [{ phone: { endsWith: digits.slice(-10) } }] : []),
        { id: q },
      ],
    }),
  };

  const [users, tiers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(after && { cursor: { id: after }, skip: 1 }),
      select: {
        id: true, name: true, email: true, phone: true, createdAt: true, suspendedAt: true, erasedAt: true,
        subscriptionTier: { select: { name: true } },
        deliveryZone: { select: { name: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    prisma.user.count({ where: { erasedAt: null } }),
  ]);
  const more = users.length > PAGE;
  const page = users.slice(0, PAGE);
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, plan, state, ...extra })) if (v) p.set(k, v);
    return `/customers?${p}`;
  };

  return (
    <>
      <PageHeader title="Customers" description={`${total.toLocaleString("en-NG")} accounts. Contact details are masked; open a customer to see more.`} />

      <Card className="mb-4">
        <form action="/customers" className="grid gap-3 sm:grid-cols-[1fr_190px_160px_auto] sm:items-center">
          <Input name="q" placeholder="Name, exact email, or phone number" defaultValue={q} aria-label="Search customers" />
          <select name="plan" defaultValue={plan ?? ""} aria-label="Plan" className={selectClass}>
            <option value="">Any plan</option>
            <option value="none">Pay as you go</option>
            {tiers.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <select name="state" defaultValue={state ?? ""} aria-label="Account state" className={selectClass}>
            <option value="">Active</option>
            <option value="suspended">Paused</option>
            <option value="erased">Erased</option>
          </select>
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </Card>

      <Card className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Customer</th>
                <th className="px-3 py-2.5 font-semibold">Contact</th>
                <th className="px-3 py-2.5 font-semibold">Area</th>
                <th className="px-3 py-2.5 font-semibold">Plan</th>
                <th className="px-3 py-2.5 text-right font-semibold">Orders</th>
                <th className="px-5 py-2.5 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {page.map((u) => (
                <tr key={u.id} className="hover:bg-soft-mist/30">
                  <td className="px-5 py-3">
                    <Link href={`/customers/${u.id}`} className="font-semibold hover:underline">
                      {u.name}
                    </Link>
                    {u.suspendedAt && (
                      <span className="ml-2">
                        <Badge tone="bad">Paused</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-carbon/70">
                    {maskEmail(u.email)}
                    <span className="block tabular-nums">{maskPhone(u.phone)}</span>
                  </td>
                  <td className="px-3 py-3">{u.deliveryZone?.name ?? "—"}</td>
                  <td className="px-3 py-3">{u.subscriptionTier ? <Badge tone="good">{u.subscriptionTier.name}</Badge> : <span className="text-carbon/50">Pay as you go</span>}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{u._count.orders}</td>
                  <td className="px-5 py-3 text-carbon/70">{when(u.createdAt)}</td>
                </tr>
              ))}
              {page.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-carbon/50">
                    No customers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 flex justify-between text-[13px] font-semibold">
        {after ? (
          <Link href={href({ after: undefined })} className="underline underline-offset-2">
            Newest
          </Link>
        ) : (
          <span />
        )}
        {more && (
          <Link href={href({ after: page[page.length - 1].id })} className="underline underline-offset-2">
            Older
          </Link>
        )}
      </div>
    </>
  );
}
