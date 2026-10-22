"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { assignableRoles, ROLE_LABEL, ROLES, type Role } from "@/lib/admin/permissions";
import { randomToken, sha256Hex } from "@/lib/admin/crypto";
import { adminOrigin } from "@/lib/admin/config";
import { revokeAllSessions, type StaffContext } from "@/lib/admin/session";
import { alertOwners, escapeHtml } from "@/lib/admin/alerts";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(80),
  role: z.enum(ROLES),
});

/** The actor may only touch someone whose role they could themselves grant. */
function canManage(ctx: StaffContext, targetRole: Role): boolean {
  return assignableRoles(ctx.staff.role as Role).includes(targetRole);
}

async function activeOwners(): Promise<number> {
  return prisma.staffUser.count({ where: { role: "OWNER", status: "ACTIVE" } });
}

export async function inviteStaff(input: { email: string; name: string; role: string }): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  return staffAction("staff.invite", async (ctx) => {
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Check the email, name and role." };
    const { email, name, role } = parsed.data;
    if (!canManage(ctx, role)) return { ok: false, code: "FORBIDDEN", error: "You can't invite someone to that role." };

    const existing = await prisma.staffUser.findUnique({ where: { email } });
    if (existing?.status === "ACTIVE") return { ok: false, code: "CONFLICT", error: "That person already has an active admin account." };
    if (existing && !canManage(ctx, existing.role as Role)) return { ok: false, code: "FORBIDDEN", error: "You can't re-invite someone with that role." };

    // One live invite per address: older ones stop working.
    await prisma.staffInvite.updateMany({ where: { email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const token = randomToken();
    const invite = await prisma.staffInvite.create({
      data: { tokenHash: sha256Hex(token), email, name, role, invitedById: ctx.staff.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });
    const link = `${adminOrigin()}/invite/${token}`;
    const emailed = await sendEmail({
      to: email,
      subject: "You're invited to Basket Admin",
      text: `${ctx.staff.name} invited you to Basket Admin as ${ROLE_LABEL[role]}.\n\nSet up your account within 24 hours: ${link}\n\nYou'll choose a password and add a passkey or authenticator app. If you weren't expecting this, ignore it.`,
      html: `<p>${escapeHtml(ctx.staff.name)} invited you to Basket Admin as <b>${escapeHtml(ROLE_LABEL[role])}</b>.</p><p><a href="${link}">Set up your account</a> within 24 hours. You'll choose a password and add a passkey or authenticator app.</p><p>If you weren't expecting this, ignore it.</p>`,
    }).catch(() => false);

    await auditStaff(ctx, { action: "staff.invite.created", targetType: "StaffInvite", targetId: invite.id, summary: `Invited ${email} as ${ROLE_LABEL[role]}` });
    await alertOwners("A staff invite was sent", [`${ctx.staff.name} invited ${email} as ${ROLE_LABEL[role]}.`]);
    revalidatePath("/staff");
    return { ok: true, data: { link, emailed } };
  });
}

export async function withdrawInvite(inviteId: string): Promise<ActionResult> {
  return staffAction("staff.invite", async (ctx) => {
    const invite = await prisma.staffInvite.findUnique({ where: { id: String(inviteId).slice(0, 40) } });
    if (!invite || invite.usedAt || invite.revokedAt) return { ok: false, code: "INVALID", error: "That invite is no longer open." };
    if (!canManage(ctx, invite.role as Role)) return { ok: false, code: "FORBIDDEN", error: "You can't withdraw that invite." };
    await prisma.staffInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
    await auditStaff(ctx, { action: "staff.invite.withdrawn", targetType: "StaffInvite", targetId: invite.id, summary: `Withdrew the invite for ${invite.email}` });
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  });
}

export async function changeRole(staffId: string, role: string): Promise<ActionResult> {
  return staffAction("staff.manage_roles", async (ctx) => {
    const next = z.enum(ROLES).safeParse(role);
    if (!next.success) return { ok: false, code: "INVALID", error: "Pick a role." };
    const target = await prisma.staffUser.findUnique({ where: { id: String(staffId).slice(0, 40) } });
    if (!target) return { ok: false, code: "INVALID", error: "That staff member doesn't exist." };
    if (target.id === ctx.staff.id) return { ok: false, code: "FORBIDDEN", error: "You can't change your own role. Ask another Owner." };
    if (!canManage(ctx, target.role as Role) || !canManage(ctx, next.data)) return { ok: false, code: "FORBIDDEN", error: "You can't make that change." };
    if (target.role === "OWNER" && next.data !== "OWNER" && target.status === "ACTIVE" && (await activeOwners()) <= 1) {
      return { ok: false, code: "CONFLICT", error: "There must always be at least one active Owner." };
    }
    if (target.role === next.data) return { ok: true, data: undefined };

    await prisma.staffUser.update({ where: { id: target.id }, data: { role: next.data } });
    // New role, new sessions: whatever they had open was granted under the old one.
    await revokeAllSessions(target.id);
    await auditStaff(ctx, {
      action: "staff.role_changed",
      targetType: "StaffUser",
      targetId: target.id,
      summary: `${target.email}: ${ROLE_LABEL[target.role as Role]} → ${ROLE_LABEL[next.data]}`,
      diff: { role: [target.role, next.data] },
    });
    await alertOwners("An admin role changed", [`${ctx.staff.name} changed ${target.name} (${target.email}) from ${ROLE_LABEL[target.role as Role]} to ${ROLE_LABEL[next.data]}.`]);
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  });
}

export async function setSuspended(staffId: string, suspend: boolean): Promise<ActionResult> {
  return staffAction("staff.suspend", async (ctx) => {
    const target = await prisma.staffUser.findUnique({ where: { id: String(staffId).slice(0, 40) } });
    if (!target) return { ok: false, code: "INVALID", error: "That staff member doesn't exist." };
    if (target.id === ctx.staff.id) return { ok: false, code: "FORBIDDEN", error: "You can't suspend yourself." };
    if (!canManage(ctx, target.role as Role)) return { ok: false, code: "FORBIDDEN", error: "You can't change that account." };
    if (suspend && target.role === "OWNER" && target.status === "ACTIVE" && (await activeOwners()) <= 1) {
      return { ok: false, code: "CONFLICT", error: "There must always be at least one active Owner." };
    }
    if (!suspend && target.status !== "SUSPENDED") return { ok: true, data: undefined };
    if (!suspend && !target.passwordHash) return { ok: false, code: "CONFLICT", error: "This account never finished setup. Send a new invite instead." };

    await prisma.staffUser.update({ where: { id: target.id }, data: { status: suspend ? "SUSPENDED" : "ACTIVE", failedLogins: 0, lockedUntil: null } });
    if (suspend) await revokeAllSessions(target.id);
    await auditStaff(ctx, { action: suspend ? "staff.suspended" : "staff.reactivated", targetType: "StaffUser", targetId: target.id, summary: target.email });
    await alertOwners(suspend ? "A staff account was suspended" : "A staff account was reactivated", [`${ctx.staff.name} ${suspend ? "suspended" : "reactivated"} ${target.name} (${target.email}).`]);
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  });
}

export async function signOutStaffEverywhere(staffId: string): Promise<ActionResult<{ count: number }>> {
  return staffAction("security.sessions_manage", async (ctx) => {
    const target = await prisma.staffUser.findUnique({ where: { id: String(staffId).slice(0, 40) } });
    if (!target) return { ok: false, code: "INVALID", error: "That staff member doesn't exist." };
    if (target.id !== ctx.staff.id && !canManage(ctx, target.role as Role)) return { ok: false, code: "FORBIDDEN", error: "You can't change that account." };
    const count = await revokeAllSessions(target.id, target.id === ctx.staff.id ? ctx.session.id : undefined);
    await auditStaff(ctx, { action: "staff.sessions_revoked", targetType: "StaffUser", targetId: target.id, summary: `${count} session(s) ended for ${target.email}` });
    revalidatePath("/staff");
    return { ok: true, data: { count } };
  });
}
