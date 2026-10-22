import "server-only";
import type { NextRequest } from "next/server";
import { getStaffContext, type StaffContext } from "./session";
import { needsStepUp } from "./guard";
import { can, type Permission, type Role } from "./permissions";
import { rateLimitShared } from "@/lib/rate-limit-db";

/**
 * The gate for admin file downloads (route handlers, not server actions):
 * same-origin only, a full session, the permission, a fresh second factor
 * when the permission needs one (428 tells the page to ask), and a rate
 * limit. Returns the staff context, or the status to answer with.
 */
export async function gateDownload(req: NextRequest, permission: Permission): Promise<{ ctx: StaffContext } | { status: 401 | 403 | 428 | 429 }> {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return { status: 403 };
  const ctx = await getStaffContext();
  if (!ctx || !ctx.session.mfaVerifiedAt || ctx.staff.status !== "ACTIVE") return { status: 401 };
  if (!can(ctx.staff.role as Role, permission)) return { status: 403 };
  if (needsStepUp(ctx, permission)) return { status: 428 };
  if (req.method !== "HEAD" && !(await rateLimitShared(`admin-download:${ctx.staff.id}`, 30, 60 * 60 * 1000)).ok) return { status: 429 };
  return { ctx };
}

export const DOWNLOAD_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
