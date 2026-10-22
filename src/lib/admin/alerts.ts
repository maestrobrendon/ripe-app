import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { adminOrigin } from "./config";

/**
 * Tells every active Owner about something security-relevant: a sign-in
 * from a new device, a locked account, a role or second-factor change.
 * Best effort: an email outage never blocks the action itself.
 */
export async function alertOwners(subject: string, lines: string[]): Promise<void> {
  const owners = await prisma.staffUser.findMany({ where: { role: "OWNER", status: "ACTIVE" }, select: { email: true } }).catch(() => []);
  const footer = `Review the audit log: ${adminOrigin()}/audit`;
  const text = [...lines, "", footer].join("\n");
  const html = `${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p><a href="${adminOrigin()}/audit">Review the audit log</a></p>`;
  await Promise.all(owners.map((o) => sendEmail({ to: o.email, subject: `[Basket Admin] ${subject}`, text, html }).catch(() => false)));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
