"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import { rateLimitShared, resetRateLimit } from "@/lib/rate-limit-db";
import { sha256Hex } from "@/lib/admin/crypto";
import { checkPassword, hashStaffPassword, needsRehash, PASSWORD_PROBLEM_TEXT, verifyStaffPassword } from "@/lib/admin/password";
import { completeMfa, getStaffContext, startHalfSession, endCurrentSession, revokeAllSessions, type StaffContext } from "@/lib/admin/session";
import {
  beginTotp,
  checkTotp,
  confirmTotp,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  mfaMethods,
  mfaSatisfied,
  newRecoveryCodes,
  passkeyAuthenticationOptions,
  passkeyRegistrationOptions,
  redeemRecoveryCode,
} from "@/lib/admin/mfa";
import { audit } from "@/lib/admin/audit";
import { alertOwners } from "@/lib/admin/alerts";
import { ROLE_LABEL, type Role } from "@/lib/admin/permissions";

/*
 * Signing in to the admin, accepting an invite, and setting up a second
 * factor. Every failure path answers the same way regardless of whether an
 * account exists, and every attempt is rate limited across all instances.
 */

const MIN = 60 * 1000;
const LOCK_AFTER = 8;
const LOCK_MS = 15 * MIN;
const GENERIC = "That email and password don't match, or the account is temporarily locked.";

export type FormState = { error?: string } | undefined;

// A real hash to compare against when the account doesn't exist, so a wrong
// email costs the same time as a wrong password (no timing oracle).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashStaffPassword("timing-equaliser-not-a-password"));

async function staffAudit(staff: { id: string; email: string; role: string } | null, action: string, summary?: string, email?: string) {
  await audit({
    actorType: "STAFF",
    actorId: staff?.id ?? null,
    actorEmail: staff?.email ?? email ?? null,
    actorRole: staff?.role ?? null,
    action,
    summary,
  }).catch(() => {});
}

/* ------------------------------- sign in ---------------------------------- */

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimitShared(`admin-login:ip:${ip}`, 20, 15 * MIN),
    rateLimitShared(`admin-login:email:${sha256Hex(email)}`, 10, 15 * MIN),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    await staffAudit(null, "staff.login.throttled", `Sign-in throttled from ${ip}`, email);
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const staff = await prisma.staffUser.findUnique({ where: { email } });
  const locked = Boolean(staff?.lockedUntil && staff.lockedUntil.getTime() > Date.now());
  const usable = staff && staff.status === "ACTIVE" && staff.passwordHash && !locked;
  const ok = await verifyStaffPassword(password, usable ? staff.passwordHash! : await getDummyHash());

  if (!usable || !ok) {
    if (staff && staff.status === "ACTIVE" && !locked) {
      // Atomic increment: parallel guesses can't each read the same count and slip past the limit.
      const { failedLogins } = await prisma.staffUser.update({
        where: { id: staff.id },
        data: { failedLogins: { increment: 1 } },
        select: { failedLogins: true },
      });
      if (failedLogins >= LOCK_AFTER) {
        await prisma.staffUser.update({ where: { id: staff.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } });
      }
      // Exactly one request sees the count reach the limit, so Owners get one email.
      if (failedLogins === LOCK_AFTER) {
        await staffAudit(staff, "staff.locked", `Locked for 15 minutes after ${LOCK_AFTER} failed sign-ins (last from ${ip})`);
        await alertOwners("An admin account was locked", [`${staff.name} (${staff.email}) was locked for 15 minutes after ${LOCK_AFTER} failed sign-in attempts.`, `Last attempt from ${ip}.`]);
      }
    }
    await staffAudit(staff, "staff.login.failed", locked ? "Attempt while locked" : "Wrong email or password", email);
    return { error: GENERIC };
  }

  const update: { failedLogins: number; lockedUntil: null; passwordHash?: string } = { failedLogins: 0, lockedUntil: null };
  if (needsRehash(staff.passwordHash!)) update.passwordHash = await hashStaffPassword(password);
  await prisma.staffUser.update({ where: { id: staff.id }, data: update });
  await resetRateLimit(`admin-login:email:${sha256Hex(email)}`);

  await startHalfSession(staff.id);
  await staffAudit(staff, "staff.login.password", "Password accepted, second factor pending");
  redirect("/login/verify");
}

/* ------------------------- second factor at sign-in ----------------------- */

async function requireHalf(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx || ctx.session.mfaVerifiedAt || ctx.staff.status !== "ACTIVE") redirect("/login");
  return ctx;
}

/** Too many wrong second factors ends the half session and locks the account. */
async function mfaAttempt(ctx: StaffContext): Promise<boolean> {
  const r = await rateLimitShared(`admin-mfa:${ctx.staff.id}`, 6, 15 * MIN);
  if (r.ok) return true;
  await prisma.staffUser.update({ where: { id: ctx.staff.id }, data: { lockedUntil: new Date(Date.now() + LOCK_MS) } });
  await revokeAllSessions(ctx.staff.id);
  await staffAudit(ctx.staff, "staff.locked", "Locked after repeated wrong second factors");
  await alertOwners("An admin account was locked", [`${ctx.staff.name} (${ctx.staff.email}) gave a wrong second factor too many times and was locked for 15 minutes.`]);
  return false;
}

async function finishSignIn(ctx: StaffContext, method: string): Promise<void> {
  const ip = await clientIp();
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await completeMfa(ctx.session.id);
  await prisma.staffUser.update({ where: { id: ctx.staff.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } });
  await resetRateLimit(`admin-mfa:${ctx.staff.id}`);

  // A browser this person hasn't signed in from in 90 days: tell the Owners.
  const seen = await prisma.auditEvent.findFirst({
    where: { actorId: ctx.staff.id, action: "staff.login.success", userAgent: ua, at: { gt: new Date(Date.now() - 90 * 24 * 60 * MIN) } },
    select: { id: true },
  });
  await staffAudit(ctx.staff, "staff.login.success", `Signed in with ${method}`);
  if (!seen) {
    await alertOwners("Admin sign-in from a new device", [
      `${ctx.staff.name} (${ctx.staff.email}, ${ROLE_LABEL[ctx.staff.role as Role]}) signed in from a device not seen before.`,
      `IP: ${ip}`,
      `Browser: ${ua ?? "unknown"}`,
    ]);
  }
}

export async function passkeySignInOptions() {
  const ctx = await requireHalf();
  return passkeyAuthenticationOptions(ctx.session.id, ctx.staff.id);
}

export async function passkeySignInVerify(response: AuthenticationResponseJSON): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireHalf();
  if (!(await mfaAttempt(ctx))) return { ok: false, error: "Too many attempts. The account is locked for 15 minutes." };
  if (!(await finishPasskeyAuthentication(ctx.session.id, ctx.staff.id, response))) {
    await staffAudit(ctx.staff, "staff.mfa.failed", "Passkey not accepted");
    return { ok: false, error: "That passkey wasn't accepted. Try again." };
  }
  await finishSignIn(ctx, "a passkey");
  return { ok: true };
}

export async function totpSignInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireHalf();
  if (!(await mfaAttempt(ctx))) return { error: "Too many attempts. The account is locked for 15 minutes." };
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "").slice(0, 6);
  if (!(await checkTotp(ctx.staff.id, code))) {
    await staffAudit(ctx.staff, "staff.mfa.failed", "Wrong authenticator code");
    return { error: "That code didn't work. Codes change every 30 seconds." };
  }
  await finishSignIn(ctx, "an authenticator code");
  redirect("/");
}

export async function recoverySignInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireHalf();
  if (!(await mfaAttempt(ctx))) return { error: "Too many attempts. The account is locked for 15 minutes." };
  if (!(await redeemRecoveryCode(ctx.staff.id, String(formData.get("code") ?? "").slice(0, 20)))) {
    await staffAudit(ctx.staff, "staff.mfa.failed", "Wrong recovery code");
    return { error: "That recovery code isn't valid or was already used." };
  }
  await finishSignIn(ctx, "a recovery code");
  const left = (await mfaMethods(ctx.staff.id)).recoveryLeft;
  await alertOwners("A recovery code was used", [`${ctx.staff.name} (${ctx.staff.email}) signed in with a recovery code. ${left} left.`]);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const ctx = await getStaffContext();
  if (ctx) await staffAudit(ctx.staff, "staff.logout");
  await endCurrentSession();
  redirect("/login");
}

/* ------------------------------- invites ---------------------------------- */

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "").slice(0, 100);
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const ip = await clientIp();
  if (!(await rateLimitShared(`admin-invite:ip:${ip}`, 10, 15 * MIN)).ok) return { error: "Too many attempts. Wait a few minutes." };

  const invite = await prisma.staffInvite.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt.getTime() < Date.now()) {
    return { error: "This invite link has expired or was already used. Ask for a new one." };
  }
  if (!name) return { error: "Add your name." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const problem = await checkPassword(password, invite.email);
  if (problem) return { error: PASSWORD_PROBLEM_TEXT[problem] };

  const passwordHash = await hashStaffPassword(password);
  const existing = await prisma.staffUser.findUnique({ where: { email: invite.email } });
  if (existing && existing.status === "ACTIVE") return { error: "This invite link has expired or was already used. Ask for a new one." };

  const staffId = await prisma.$transaction(async (tx) => {
    // Single use, even if the link is submitted twice at once.
    const { count } = await tx.staffInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date() } });
    if (count !== 1) throw new Error("invite already used");
    if (existing) {
      // A re-invite after suspension or a lost device: start the account over, factors included.
      await tx.staffPasskey.deleteMany({ where: { staffId: existing.id } });
      await tx.staffRecoveryCode.deleteMany({ where: { staffId: existing.id } });
      await tx.staffSession.deleteMany({ where: { staffId: existing.id } });
      await tx.staffUser.update({
        where: { id: existing.id },
        data: { name, role: invite.role, status: "INVITED", passwordHash, passwordChangedAt: new Date(), totpSecretEnc: null, totpEnabledAt: null, totpLastCounter: null, failedLogins: 0, lockedUntil: null },
      });
      return existing.id;
    }
    const created = await tx.staffUser.create({
      data: { email: invite.email, name, role: invite.role, status: "INVITED", passwordHash, passwordChangedAt: new Date() },
    });
    return created.id;
  }).catch(() => null);
  if (!staffId) return { error: "This invite link has expired or was already used. Ask for a new one." };

  await audit({ actorType: "STAFF", actorId: staffId, actorEmail: invite.email, actorRole: invite.role, action: "staff.invite.accepted", targetType: "StaffInvite", targetId: invite.id });
  await startHalfSession(staffId);
  redirect("/setup");
}

/* --------------------------- second-factor setup -------------------------- */

async function requireSetup(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx || ctx.staff.status !== "INVITED") redirect("/login");
  return ctx;
}

export async function setupPasskeyOptions() {
  const ctx = await requireSetup();
  return passkeyRegistrationOptions(ctx.session.id, ctx.staff);
}

export async function setupPasskeyVerify(response: RegistrationResponseJSON, name: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireSetup();
  if (!(await finishPasskeyRegistration(ctx.session.id, ctx.staff.id, response, name))) return { ok: false, error: "That passkey couldn't be saved. Try again." };
  await staffAudit(ctx.staff, "staff.mfa.passkey_added", `Passkey "${name}" added during setup`);
  return { ok: true };
}

export async function setupTotpBegin(): Promise<{ qrSvg: string; secret: string }> {
  const ctx = await requireSetup();
  const { qrSvg, secret } = await beginTotp(ctx.staff);
  return { qrSvg, secret };
}

export async function setupTotpConfirm(code: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireSetup();
  if (!(await rateLimitShared(`admin-setup-totp:${ctx.staff.id}`, 10, 15 * MIN)).ok) return { ok: false, error: "Too many attempts. Wait a few minutes." };
  if (!(await confirmTotp(ctx.staff.id, code.replace(/\s+/g, "").slice(0, 6)))) return { ok: false, error: "That code didn't match. Check the app and try the newest code." };
  await staffAudit(ctx.staff, "staff.mfa.totp_enabled", "Authenticator app added during setup");
  return { ok: true };
}

export async function setupRecoveryCodes(): Promise<{ ok: boolean; codes?: string[]; error?: string }> {
  const ctx = await requireSetup();
  if (!mfaSatisfied(ctx.staff.role, await mfaMethods(ctx.staff.id))) {
    return { ok: false, error: ctx.staff.role === "OWNER" ? "Owners need a passkey first." : "Add a passkey or an authenticator app first." };
  }
  return { ok: true, codes: await newRecoveryCodes(ctx.staff.id) };
}

export async function finishSetupAction(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireSetup();
  const m = await mfaMethods(ctx.staff.id);
  if (!mfaSatisfied(ctx.staff.role, m) || m.recoveryLeft === 0) return { ok: false, error: "Finish both steps first." };
  await prisma.staffUser.update({ where: { id: ctx.staff.id }, data: { status: "ACTIVE", lastLoginAt: new Date(), lastLoginIp: await clientIp() } });
  await completeMfa(ctx.session.id);
  await staffAudit({ ...ctx.staff }, "staff.activated", "Second factor set up; account active");
  await alertOwners("A staff member joined the admin", [`${ctx.staff.name} (${ctx.staff.email}) finished setting up as ${ROLE_LABEL[ctx.staff.role as Role]}.`]);
  return { ok: true };
}
