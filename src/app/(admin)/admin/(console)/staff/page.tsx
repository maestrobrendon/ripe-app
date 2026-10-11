import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { assignableRoles, can, ROLE_LABEL, type Role } from "@/lib/admin/permissions";
import { PageHeader } from "../../_ui/kit";
import { StaffView, type StaffRow, type InviteRow } from "./staff-view";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { staff: me } = await requireStaffPage("staff.view");
  const role = me.role as Role;
  const now = new Date();

  const [staff, invites, sessionCounts] = await Promise.all([
    prisma.staffUser.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true, totpEnabledAt: true, lockedUntil: true,
        _count: { select: { passkeys: true } },
      },
    }),
    prisma.staffInvite.findMany({
      where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, expiresAt: true },
    }),
    prisma.staffSession.groupBy({
      by: ["staffId"],
      where: { revokedAt: null, expiresAt: { gt: now }, mfaVerifiedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const live = new Map(sessionCounts.map((s) => [s.staffId, s._count._all]));

  const rows: StaffRow[] = staff.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    role: s.role as Role,
    status: s.status,
    lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    passkeys: s._count.passkeys,
    totp: Boolean(s.totpEnabledAt),
    locked: Boolean(s.lockedUntil && s.lockedUntil > now),
    sessions: live.get(s.id) ?? 0,
    isMe: s.id === me.id,
  }));
  const inviteRows: InviteRow[] = invites.map((i) => ({ ...i, role: i.role as Role, expiresAt: i.expiresAt.toISOString() }));

  return (
    <>
      <PageHeader title="Staff" description="Who can sign in to the admin, and what their role lets them do. Every change here is recorded and emailed to Owners." />
      <StaffView
        rows={rows}
        invites={inviteRows}
        assignable={assignableRoles(role).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        perms={{
          invite: can(role, "staff.invite"),
          roles: can(role, "staff.manage_roles"),
          suspend: can(role, "staff.suspend"),
          sessions: can(role, "security.sessions_manage"),
        }}
      />
    </>
  );
}
