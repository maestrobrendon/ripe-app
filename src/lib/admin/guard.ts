import "server-only";
import { redirect } from "next/navigation";
import { can, STEP_UP, STEP_UP_SECONDS, type Permission, type Role } from "./permissions";
import { getStaffContext, type StaffContext } from "./session";
import { audit } from "./audit";

/*
 * The single gate for the admin. Every page calls requireStaffPage and every
 * server action is wrapped in staffAction, which checks, in order: a valid
 * session, a completed second factor, an active account, the permission, and
 * (for sensitive permissions) a second factor in the last ten minutes.
 *
 * Actions return a result object instead of throwing: Next hides server
 * action error messages in production, and the UI needs to know *why*
 * (sign in again, not allowed, confirm it's you).
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: "AUTH" | "FORBIDDEN" | "STEP_UP" | "INVALID" | "CONFLICT" | "RATE_LIMIT" | "ERROR" };

export function needsStepUp(ctx: StaffContext, permission?: Permission): boolean {
  if (!permission || !STEP_UP.has(permission)) return false;
  const at = ctx.session.stepUpAt?.getTime() ?? 0;
  return Date.now() - at > STEP_UP_SECONDS * 1000;
}

/** For pages and layouts. Redirects to sign-in, the second-factor screen or /forbidden. */
export async function requireStaffPage(permission?: Permission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (!ctx.session.mfaVerifiedAt) redirect(ctx.staff.status === "INVITED" ? "/setup" : "/login/verify");
  if (ctx.staff.status !== "ACTIVE") redirect("/login");
  if (permission && !can(ctx.staff.role as Role, permission)) {
    await audit({
      actorType: "STAFF",
      actorId: ctx.staff.id,
      actorEmail: ctx.staff.email,
      actorRole: ctx.staff.role,
      action: "security.forbidden",
      summary: `Opened a page needing ${permission}`,
    }).catch(() => {});
    redirect("/forbidden");
  }
  return ctx;
}

/**
 * Wraps a server action body. Unexpected errors are logged with a reference
 * and reported generically, so stack traces and internals never reach the UI.
 */
export async function staffAction<T>(
  permission: Permission | null,
  fn: (ctx: StaffContext) => Promise<ActionResult<T>>,
  opts: { stepUp?: boolean } = {},
): Promise<ActionResult<T>> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.session.mfaVerifiedAt || ctx.staff.status !== "ACTIVE") {
    return { ok: false, code: "AUTH", error: "Your session has ended. Sign in again." };
  }
  if (permission && !can(ctx.staff.role as Role, permission)) {
    await audit({
      actorType: "STAFF",
      actorId: ctx.staff.id,
      actorEmail: ctx.staff.email,
      actorRole: ctx.staff.role,
      action: "security.forbidden",
      summary: `Tried ${permission} without permission`,
    }).catch(() => {});
    return { ok: false, code: "FORBIDDEN", error: "Your role can't do that." };
  }
  const stale = Date.now() - (ctx.session.stepUpAt?.getTime() ?? 0) > STEP_UP_SECONDS * 1000;
  if (needsStepUp(ctx, permission ?? undefined) || (opts.stepUp && stale)) {
    return { ok: false, code: "STEP_UP", error: "Confirm it's you to continue." };
  }
  try {
    return await fn(ctx);
  } catch (err) {
    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.error(JSON.stringify({ scope: "admin-action", ref, permission, staffId: ctx.staff.id, error: err instanceof Error ? err.message : String(err) }));
    return { ok: false, code: "ERROR", error: `Something went wrong (ref ${ref}). Nothing was changed.` };
  }
}

/** Audit shorthand for an action taken by the signed-in staff member. */
export function auditStaff(ctx: StaffContext, e: { action: string; targetType?: string; targetId?: string; summary?: string; diff?: unknown }) {
  return audit({ actorType: "STAFF", actorId: ctx.staff.id, actorEmail: ctx.staff.email, actorRole: ctx.staff.role, ...e });
}
