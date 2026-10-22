"use server";

import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { verifyAuditChain } from "@/lib/admin/audit";
import { rateLimitShared } from "@/lib/rate-limit-db";

/** Re-walks the whole hash chain. Read-only, but heavy, so it's rate-limited and recorded. */
export async function verifyChainAction(): Promise<ActionResult<{ intact: boolean; checked: number; brokenAtSeq?: string }>> {
  return staffAction("security.audit_view", async (ctx) => {
    if (!(await rateLimitShared(`admin-audit-verify:${ctx.staff.id}`, 6, 10 * 60 * 1000)).ok) {
      return { ok: false, code: "RATE_LIMIT", error: "The check ran recently. Try again in a few minutes." };
    }
    const checked = await prisma.auditEvent.count();
    const broken = await verifyAuditChain();
    const brokenRow = broken ? await prisma.auditEvent.findUnique({ where: { id: broken.brokenAt }, select: { seq: true } }) : null;
    await auditStaff(ctx, {
      action: broken ? "security.audit_chain_broken" : "security.audit_chain_verified",
      summary: broken ? `Chain broken at #${brokenRow?.seq ?? "?"} (${broken.reason})` : `${checked} events verified`,
    });
    return { ok: true, data: { intact: !broken, checked, brokenAtSeq: brokenRow?.seq.toString() } };
  });
}
