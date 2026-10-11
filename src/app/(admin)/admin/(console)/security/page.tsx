import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { mfaMethods } from "@/lib/admin/mfa";
import { PageHeader } from "../../_ui/kit";
import { SecurityView } from "./security-view";

export const metadata: Metadata = { title: "My security" };

export default async function SecurityPage() {
  const { staff, session } = await requireStaffPage();
  const [passkeys, sessions, methods] = await Promise.all([
    prisma.staffPasskey.findMany({
      where: { staffId: staff.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true },
    }),
    prisma.staffSession.findMany({
      where: { staffId: staff.id, revokedAt: null, expiresAt: { gt: new Date() }, mfaVerifiedAt: { not: null } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true },
    }),
    mfaMethods(staff.id),
  ]);

  return (
    <>
      <PageHeader title="My security" description="How you sign in to the admin. Changes here need you to confirm it's you, sign out your other devices, and are emailed to Owners." />
      <SecurityView
        isOwner={staff.role === "OWNER"}
        passwordChangedAt={staff.passwordChangedAt?.toISOString() ?? null}
        totp={methods.totp}
        recoveryLeft={methods.recoveryLeft}
        passkeys={passkeys.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), lastUsedAt: p.lastUsedAt?.toISOString() ?? null }))}
        sessions={sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === session.id }))}
      />
    </>
  );
}
