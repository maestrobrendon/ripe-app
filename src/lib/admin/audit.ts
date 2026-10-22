import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import { chainHash, GENESIS, redact, verifyChain } from "./audit-chain";

/*
 * The admin's audit log: who did what, to what, when and from where. One
 * append-only, hash-chained table (AuditEvent). Writes take a transaction-
 * scoped advisory lock so two events can never claim the same previous
 * hash and fork the chain.
 */

export type AuditInput = {
  actorType: "STAFF" | "SYSTEM" | "CUSTOMER";
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
  /** Before/after values. Secret-looking keys are redacted before storing. */
  diff?: unknown;
};

// Any fixed bigint: the lock is just a mutex over "append to the audit chain".
const AUDIT_LOCK = 4207731;

async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    return { ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    // Outside a request (a script): no request context to record.
    return { ip: null, userAgent: null };
  }
}

/** The content a row's hash covers. Must match exactly what verifyAuditChain rebuilds. */
function body(e: {
  at: Date;
  actorType: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  diff: unknown;
  ip: string | null;
  userAgent: string | null;
}) {
  return { ...e, at: e.at.toISOString() };
}

export async function audit(input: AuditInput): Promise<void> {
  const ctx = await requestContext();
  const row = {
    at: new Date(),
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    actorEmail: input.actorEmail ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    summary: input.summary?.slice(0, 500) ?? null,
    diff: input.diff === undefined ? null : (redact(input.diff) as object | null),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK}::bigint)`;
    const last = await tx.auditEvent.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
    const prevHash = last?.hash ?? GENESIS;
    const hash = chainHash(prevHash, body(row));
    await tx.auditEvent.create({ data: { ...row, diff: row.diff ?? undefined, prevHash, hash } });
  });
}

/**
 * Re-walks the whole chain. Returns null when every row checks out, or the
 * first row that doesn't (edited, removed or reordered history).
 */
export async function verifyAuditChain(): Promise<{ brokenAt: string; reason: "prev" | "hash" } | null> {
  const rows = await prisma.auditEvent.findMany({ orderBy: { seq: "asc" } });
  return verifyChain(
    rows.map((r) => ({
      id: r.id,
      prevHash: r.prevHash,
      hash: r.hash,
      body: body({
        at: r.at,
        actorType: r.actorType,
        actorId: r.actorId,
        actorEmail: r.actorEmail,
        actorRole: r.actorRole,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        summary: r.summary,
        diff: r.diff,
        ip: r.ip,
        userAgent: r.userAgent,
      }),
    })),
  );
}
