import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auditStaff, requireStaffPage } from "@/lib/admin/guard";
import { Card, PageHeader, cx } from "../../../../_ui/kit";
import { when } from "../../../../_ui/format";
import { handleFor } from "../handle";

export const metadata: Metadata = { title: "Kachi chat" };

/** One shared conversation. Refused (as not found) unless the customer has consented right now. */
export default async function KachiThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("insights.kachi_review");
  const { id } = await params;
  const thread = await prisma.assistantThread.findFirst({
    where: { id: id.slice(0, 40), user: { kachiReviewConsentAt: { not: null }, erasedAt: null } },
    include: { messages: { where: { role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "asc" }, take: 400 } },
  });
  if (!thread) notFound();
  await auditStaff(ctx, { action: "insights.kachi_chat_viewed", targetType: "AssistantThread", targetId: thread.id, summary: `Read a shared Kachi chat (${thread.messages.length} messages)` });

  return (
    <>
      <Link href="/insights/kachi" className="text-[13px] font-semibold text-carbon/60 underline underline-offset-2">
        ← Shared chats
      </Link>
      <PageHeader title={thread.title} description={`${handleFor(thread.userId)} · started ${when(thread.createdAt)}`} />
      <Card className="max-w-3xl">
        <ol className="space-y-3">
          {thread.messages.map((m) => (
            <li key={m.id} className={cx("flex", m.role === "USER" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] whitespace-pre-line", m.role === "USER" ? "bg-carbon text-paper-white" : "bg-soft-mist")}>
                {m.content}
                <p className={cx("mt-1 text-[11px]", m.role === "USER" ? "text-paper-white/50" : "text-carbon/40")}>
                  {m.role === "USER" ? "Customer" : "Kachi"} · {when(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
          {thread.messages.length === 0 && <li className="text-[13px] text-carbon/50">No messages.</li>}
        </ol>
      </Card>
    </>
  );
}
