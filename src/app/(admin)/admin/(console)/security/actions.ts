"use server";

import { revalidatePath } from "next/cache";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { rateLimitShared } from "@/lib/rate-limit-db";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { revokeAllSessions, type StaffContext } from "@/lib/admin/session";
import { checkPassword, hashStaffPassword, MAX_LENGTH, PASSWORD_PROBLEM_TEXT, verifyStaffPassword } from "@/lib/admin/password";
import {
  beginTotp,
  confirmTotp,
  disableTotp,
  finishPasskeyRegistration,
  mfaMethods,
  newRecoveryCodes,
  passkeyRegistrationOptions,
} from "@/lib/admin/mfa";
import { alertOwners } from "@/lib/admin/alerts";

/*
 * The signed-in staff member's own security settings. No permission is
 * needed to manage your own account, but every change that adds or removes a
 * way in needs a fresh second factor, signs out your other devices, and is
 * emailed to Owners.
 */

const STEP_UP = { stepUp: true } as const;

async function mfaChanged(ctx: StaffContext, action: string, summary: string) {
  await revokeAllSessions(ctx.staff.id, ctx.session.id);
  await auditStaff(ctx, { action, targetType: "StaffUser", targetId: ctx.staff.id, summary });
  await alertOwners("An admin's sign-in methods changed", [`${ctx.staff.name} (${ctx.staff.email}): ${summary}.`, "Their other sessions were signed out."]);
  revalidatePath("/security");
}

/* -------------------------------- passkeys ------------------------------- */

export async function addPasskeyOptions(): Promise<ActionResult<Awaited<ReturnType<typeof passkeyRegistrationOptions>>>> {
  return staffAction(
    null,
    async (ctx) => {
      if ((await prisma.staffPasskey.count({ where: { staffId: ctx.staff.id } })) >= 10) {
        return { ok: false, code: "CONFLICT", error: "You already have ten passkeys. Remove one first." };
      }
      return { ok: true, data: await passkeyRegistrationOptions(ctx.session.id, ctx.staff) };
    },
    STEP_UP,
  );
}

export async function addPasskeyVerify(response: RegistrationResponseJSON, name: string): Promise<ActionResult> {
  return staffAction(
    null,
    async (ctx) => {
      if (!(await finishPasskeyRegistration(ctx.session.id, ctx.staff.id, response, String(name)))) {
        return { ok: false, code: "INVALID", error: "That passkey couldn't be added. Try again." };
      }
      await mfaChanged(ctx, "staff.passkey_added", `added a passkey "${String(name).trim().slice(0, 60) || "Passkey"}"`);
      return { ok: true, data: undefined };
    },
    STEP_UP,
  );
}

export async function removePasskey(passkeyId: string): Promise<ActionResult> {
  return staffAction(
    null,
    async (ctx) => {
      const key = await prisma.staffPasskey.findFirst({ where: { id: String(passkeyId).slice(0, 40), staffId: ctx.staff.id } });
      if (!key) return { ok: false, code: "INVALID", error: "That passkey isn't on your account." };
      const m = await mfaMethods(ctx.staff.id);
      if (m.passkeys <= 1 && ctx.staff.role === "OWNER") return { ok: false, code: "CONFLICT", error: "Owners must keep at least one passkey. Add another before removing this one." };
      if (m.passkeys <= 1 && !m.totp) return { ok: false, code: "CONFLICT", error: "This is your only way to sign in. Add another passkey or an authenticator app first." };
      await prisma.staffPasskey.delete({ where: { id: key.id } });
      await mfaChanged(ctx, "staff.passkey_removed", `removed the passkey "${key.name}"`);
      return { ok: true, data: undefined };
    },
    STEP_UP,
  );
}

/* --------------------------- authenticator app --------------------------- */

export async function startTotpSetup(): Promise<ActionResult<{ secret: string; qrSvg: string }>> {
  return staffAction(
    null,
    async (ctx) => {
      const m = await mfaMethods(ctx.staff.id);
      // Starting over switches the current app off until the new one is confirmed,
      // so that's only allowed when a passkey would still let you in.
      if (m.totp && m.passkeys === 0) return { ok: false, code: "CONFLICT", error: "Add a passkey before replacing your authenticator app, so you're never left without a way in." };
      const { secret, qrSvg } = await beginTotp(ctx.staff);
      return { ok: true, data: { secret, qrSvg } };
    },
    STEP_UP,
  );
}

export async function confirmTotpSetup(code: string): Promise<ActionResult> {
  return staffAction(null, async (ctx) => {
    if (!(await rateLimitShared(`admin-totp-setup:${ctx.staff.id}`, 8, 15 * 60 * 1000)).ok) {
      return { ok: false, code: "RATE_LIMIT", error: "Too many attempts. Wait a few minutes." };
    }
    if (!(await confirmTotp(ctx.staff.id, String(code).replace(/\s+/g, "").slice(0, 6)))) {
      return { ok: false, code: "INVALID", error: "That code didn't match. Check the time on your phone and try the next one." };
    }
    await mfaChanged(ctx, "staff.totp_enabled", "turned on an authenticator app");
    return { ok: true, data: undefined };
  });
}

export async function turnOffTotp(): Promise<ActionResult> {
  return staffAction(
    null,
    async (ctx) => {
      const m = await mfaMethods(ctx.staff.id);
      if (!m.totp) return { ok: true, data: undefined };
      if (m.passkeys === 0) return { ok: false, code: "CONFLICT", error: "This is your only way to sign in. Add a passkey first." };
      await disableTotp(ctx.staff.id);
      await mfaChanged(ctx, "staff.totp_disabled", "turned off their authenticator app");
      return { ok: true, data: undefined };
    },
    STEP_UP,
  );
}

/* ----------------------------- recovery codes ---------------------------- */

export async function regenerateRecoveryCodes(): Promise<ActionResult<{ codes: string[] }>> {
  return staffAction(
    null,
    async (ctx) => {
      const codes = await newRecoveryCodes(ctx.staff.id);
      await mfaChanged(ctx, "staff.recovery_regenerated", "made new recovery codes (the old ones stopped working)");
      return { ok: true, data: { codes } };
    },
    STEP_UP,
  );
}

/* -------------------------------- password ------------------------------- */

export async function changePassword(input: { current: string; next: string }): Promise<ActionResult> {
  return staffAction(
    null,
    async (ctx) => {
      const current = String(input.current ?? "").slice(0, MAX_LENGTH + 1);
      const next = String(input.next ?? "");
      if (!(await rateLimitShared(`admin-pw-change:${ctx.staff.id}`, 5, 15 * 60 * 1000)).ok) {
        return { ok: false, code: "RATE_LIMIT", error: "Too many attempts. Wait a few minutes." };
      }
      if (!ctx.staff.passwordHash || !(await verifyStaffPassword(current, ctx.staff.passwordHash))) {
        await auditStaff(ctx, { action: "staff.password_change_failed", targetType: "StaffUser", targetId: ctx.staff.id, summary: "Wrong current password" });
        return { ok: false, code: "INVALID", error: "Your current password isn't right." };
      }
      if (current === next) return { ok: false, code: "INVALID", error: "Choose a password you haven't used here." };
      const problem = await checkPassword(next, ctx.staff.email);
      if (problem) return { ok: false, code: "INVALID", error: PASSWORD_PROBLEM_TEXT[problem] };

      await prisma.staffUser.update({ where: { id: ctx.staff.id }, data: { passwordHash: await hashStaffPassword(next), passwordChangedAt: new Date() } });
      const ended = await revokeAllSessions(ctx.staff.id, ctx.session.id);
      await auditStaff(ctx, { action: "staff.password_changed", targetType: "StaffUser", targetId: ctx.staff.id, summary: `Password changed; ${ended} other session(s) ended` });
      await alertOwners("An admin changed their password", [`${ctx.staff.name} (${ctx.staff.email}) changed their password. Their other sessions were signed out.`]);
      revalidatePath("/security");
      return { ok: true, data: undefined };
    },
    STEP_UP,
  );
}

/* -------------------------------- sessions ------------------------------- */

export async function endMySession(sessionId: string): Promise<ActionResult> {
  return staffAction(null, async (ctx) => {
    const id = String(sessionId).slice(0, 40);
    if (id === ctx.session.id) return { ok: false, code: "INVALID", error: "Use Sign out to end this session." };
    const { count } = await prisma.staffSession.deleteMany({ where: { id, staffId: ctx.staff.id } });
    if (count === 0) return { ok: false, code: "INVALID", error: "That session has already ended." };
    await auditStaff(ctx, { action: "staff.session_ended", targetType: "StaffSession", targetId: id, summary: "Ended one of their own sessions" });
    revalidatePath("/security");
    return { ok: true, data: undefined };
  });
}
