import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/session";
import { mfaMethods, mfaSatisfied } from "@/lib/admin/mfa";
import { AuthShell } from "../auth-shell";
import { SetupSteps } from "./setup-steps";

export const metadata: Metadata = { title: "Set up sign-in" };

export default async function SetupPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (ctx.staff.status === "ACTIVE" && ctx.session.mfaVerifiedAt) redirect("/");
  if (ctx.staff.status !== "INVITED") redirect("/login");
  const m = await mfaMethods(ctx.staff.id);
  const owner = ctx.staff.role === "OWNER";
  return (
    <AuthShell
      title="Protect your account"
      subtitle={
        owner
          ? "Owners sign in with a passkey: it can't be phished. You can add an authenticator app as a backup afterwards."
          : "Add a passkey (recommended) or an authenticator app. You'll use it every time you sign in."
      }
    >
      <SetupSteps owner={owner} factorDone={mfaSatisfied(ctx.staff.role, m)} hasPasskey={m.passkeys > 0} />
    </AuthShell>
  );
}
