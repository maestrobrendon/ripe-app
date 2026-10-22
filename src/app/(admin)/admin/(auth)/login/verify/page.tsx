import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/session";
import { mfaMethods } from "@/lib/admin/mfa";
import { AuthShell } from "../../auth-shell";
import { VerifyChoices } from "./verify-choices";

export const metadata: Metadata = { title: "Confirm it's you" };

export default async function VerifyPage() {
  const ctx = await getStaffContext();
  if (!ctx || ctx.staff.status !== "ACTIVE") redirect("/login");
  if (ctx.session.mfaVerifiedAt) redirect("/");
  const m = await mfaMethods(ctx.staff.id);
  return (
    <AuthShell title="Confirm it's you" subtitle={`Signing in as ${ctx.staff.email}.`}>
      <VerifyChoices hasPasskey={m.passkeys > 0} hasTotp={m.totp} hasRecovery={m.recoveryLeft > 0} />
    </AuthShell>
  );
}
