import Link from "next/link";
import { PasswordField } from "@/components/ui/password-field";
import { AuthAlert, AuthShell, authPrimaryButton } from "@/components/auth-shell";
import { resetPassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This password reset link is invalid or has already been used. Reset links expire 30 minutes after they are sent."
        photo="kitchen"
      >
        <Link href="/forgot-password" className={`mt-8 ${authPrimaryButton}`}>
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="At least 8 characters. You'll use it to sign in from now on." photo="kitchen">
      {error === "expired" ? (
        <AuthAlert>
          That link has expired or was already used.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </AuthAlert>
      ) : error === "throttled" ? (
        <AuthAlert>Too many attempts. Please wait a few minutes and try again.</AuthAlert>
      ) : error === "invalid" ? (
        <AuthAlert>Passwords must be at least 8 characters and match.</AuthAlert>
      ) : null}

      <form action={resetPassword} className="mt-8 space-y-5">
        <input type="hidden" name="token" value={token} />
        <PasswordField name="password" label="New password" required minLength={8} maxLength={200} autoComplete="new-password" />
        <PasswordField name="confirm" label="Confirm password" required minLength={8} maxLength={200} autoComplete="new-password" />
        <button type="submit" className={authPrimaryButton}>
          Reset password
        </button>
      </form>
    </AuthShell>
  );
}
