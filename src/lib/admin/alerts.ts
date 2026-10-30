import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-layout";
import { adminOrigin } from "./config";

/**
 * Tells every active Owner about something security-relevant: a sign-in
 * from a new device, a locked account, a role or second-factor change.
 * Best effort: an email outage never blocks the action itself.
 */
export async function alertOwners(subject: string, lines: string[]): Promise<void> {
  const owners = await prisma.staffUser.findMany({ where: { role: "OWNER", status: "ACTIVE" }, select: { email: true } }).catch(() => []);
  const body = renderEmail({
    staff: true,
    tag: { label: "Admin alert", tone: "ember" },
    heading: subject,
    paragraphs: lines,
    button: { href: `${adminOrigin()}/audit`, label: "Review the audit log" },
  });
  await Promise.all(owners.map((o) => sendEmail({ to: o.email, subject: `[Basket Admin] ${subject}`, ...body }).catch(() => false)));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
