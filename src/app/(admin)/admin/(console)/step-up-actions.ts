"use server";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { rateLimitShared } from "@/lib/rate-limit-db";
import { getStaffContext, recordStepUp, type StaffContext } from "@/lib/admin/session";
import { checkTotp, finishPasskeyAuthentication, mfaMethods, passkeyAuthenticationOptions } from "@/lib/admin/mfa";
import { audit } from "@/lib/admin/audit";

/*
 * Step-up: a fresh second factor inside a full session, required before
 * sensitive actions (see STEP_UP in permissions.ts). Success rotates the
 * session token and stamps stepUpAt; it lasts ten minutes.
 */

async function full(): Promise<StaffContext | null> {
  const ctx = await getStaffContext();
  return ctx && ctx.session.mfaVerifiedAt && ctx.staff.status === "ACTIVE" ? ctx : null;
}

async function allowed(ctx: StaffContext) {
  return (await rateLimitShared(`admin-stepup:${ctx.staff.id}`, 8, 15 * 60 * 1000)).ok;
}

async function done(ctx: StaffContext, method: string) {
  await recordStepUp(ctx.session.id, ctx.session.expiresAt);
  await audit({ actorType: "STAFF", actorId: ctx.staff.id, actorEmail: ctx.staff.email, actorRole: ctx.staff.role, action: "staff.step_up", summary: `Confirmed with ${method}` });
}

export async function stepUpMethods(): Promise<{ passkey: boolean; totp: boolean } | null> {
  const ctx = await full();
  if (!ctx) return null;
  const m = await mfaMethods(ctx.staff.id);
  return { passkey: m.passkeys > 0, totp: m.totp };
}

export async function stepUpPasskeyOptions() {
  const ctx = await full();
  if (!ctx || !(await allowed(ctx))) return null;
  return passkeyAuthenticationOptions(ctx.session.id, ctx.staff.id);
}

export async function stepUpPasskeyVerify(response: AuthenticationResponseJSON): Promise<{ ok: boolean; error?: string }> {
  const ctx = await full();
  if (!ctx) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!(await finishPasskeyAuthentication(ctx.session.id, ctx.staff.id, response))) return { ok: false, error: "That passkey wasn't accepted." };
  await done(ctx, "a passkey");
  return { ok: true };
}

export async function stepUpTotp(code: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await full();
  if (!ctx) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!(await allowed(ctx))) return { ok: false, error: "Too many attempts. Wait a few minutes." };
  if (!(await checkTotp(ctx.staff.id, code.replace(/\s+/g, "").slice(0, 6)))) return { ok: false, error: "That code didn't work." };
  await done(ctx, "an authenticator code");
  return { ok: true };
}
