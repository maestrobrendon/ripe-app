import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { handleFor } from "./handle";
import { Badge, Card, PageHeader } from "../../../_ui/kit";
import { when } from "../../../_ui/format";

export const metadata: Metadata = { title: "Kachi chats" };

const SOURCE: Record<string, string> = { ASSISTANT: "Kachi", BASKET_SHEET: "Basket", CART_SHEET: "Cart", MEAL_PLANNER: "Meal plan", PRODUCE_PLANNER: "Produce plan" };

/**
 * Kachi conversations from customers who turned on "Help improve Kachi".
 * Nobody else's chats are listed or can be opened. Customers appear by an
 * anonymous handle, never by name or contact.
 */
export default async function KachiReviewPage() {
  await requireStaffPage("insights.kachi_review");
  const [threads, consenting] = await Promise.all([
    prisma.assistantThread.findMany({
      where: { user: { kachiReviewConsentAt: { not: null }, erasedAt: null } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, source: true, updatedAt: true, userId: true, _count: { select: { messages: true } } },
    }),
    prisma.user.count({ where: { kachiReviewConsentAt: { not: null }, erasedAt: null } }),
  ]);

  return (
    <>
      <PageHeader
        title="Kachi chats"
        description={`Only from customers who said yes to "Help improve Kachi" (${consenting} so far). Opening a chat is recorded. Use what you read to improve Kachi, not to contact anyone.`}
      />
      <Card className="p-0! overflow-hidden">
        <ul className="divide-y divide-black/5">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/insights/kachi/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] hover:bg-soft-mist/30">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="text-carbon/55">
                    {handleFor(t.userId)} · {t._count.messages} message{t._count.messages === 1 ? "" : "s"} · {when(t.updatedAt)}
                  </p>
                </div>
                <Badge>{SOURCE[t.source] ?? t.source}</Badge>
              </Link>
            </li>
          ))}
          {threads.length === 0 && <li className="px-5 py-10 text-center text-[13px] text-carbon/50">No shared chats yet. Customers turn this on under Account → Privacy.</li>}
        </ul>
      </Card>
    </>
  );
}
