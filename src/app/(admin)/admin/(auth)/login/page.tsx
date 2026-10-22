import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/session";
import { AuthShell } from "../auth-shell";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const ctx = await getStaffContext();
  if (ctx?.session.mfaVerifiedAt && ctx.staff.status === "ACTIVE") redirect("/");
  return (
    <AuthShell title="Sign in" subtitle="Use your staff email and password. You'll confirm it's you on the next step.">
      <SignInForm />
    </AuthShell>
  );
}
