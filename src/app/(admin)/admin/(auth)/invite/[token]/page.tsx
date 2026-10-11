import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/admin/crypto";
import { ROLE_LABEL, type Role } from "@/lib/admin/permissions";
import { MIN_LENGTH } from "@/lib/admin/password";
import { AuthShell } from "../../auth-shell";
import { Alert } from "../../../_ui/kit";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Join Basket Admin" };

/** The invite behind a link, if it can still be used. */
async function openInvite(token: string) {
  if (token.length > 100) return null;
  return prisma.staffInvite.findFirst({ where: { tokenHash: sha256Hex(token), usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await openInvite(token);

  if (!invite) {
    return (
      <AuthShell title="This invite can't be used">
        <Alert tone="error">The link has expired, was already used, or was withdrawn. Ask whoever invited you for a new one.</Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Join Basket Admin"
      subtitle={
        <>
          You&apos;re invited as <b className="font-semibold text-carbon">{ROLE_LABEL[invite.role as Role]}</b> with {invite.email}. Choose a
          password, then set up a passkey or authenticator.
        </>
      }
    >
      <AcceptInviteForm token={token} name={invite.name} minLength={MIN_LENGTH} />
    </AuthShell>
  );
}
