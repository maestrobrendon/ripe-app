import Link from "next/link";
import { PasswordField } from "@/components/ui/password-field";
import { resetPassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold">Link expired</h1>
        <p className="mt-3 text-sm text-muted">
          This password reset link is invalid or has already been used. Reset links expire
          30 minutes after they are sent.
        </p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-basket-green underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>

      {error === "expired" ? (
        <p className="mt-4 rounded-lg border border-basket-terracotta bg-basket-terracotta-light p-3 text-sm text-basket-terracotta-dark">
          That link has expired or was already used. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </p>
      ) : error === "throttled" ? (
        <p className="mt-4 rounded-lg border border-basket-terracotta bg-basket-terracotta-light p-3 text-sm text-basket-terracotta-dark">
          Too many attempts. Please wait a few minutes and try again.
        </p>
      ) : error === "invalid" ? (
        <p className="mt-4 rounded-lg border border-basket-terracotta bg-basket-terracotta-light p-3 text-sm text-basket-terracotta-dark">
          Passwords must be at least 8 characters and match.
        </p>
      ) : null}

      <form action={resetPassword} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <PasswordField name="password" label="New password" required minLength={8} maxLength={200} />
        <PasswordField name="confirm" label="Confirm password" required minLength={8} maxLength={200} />
        <button
          type="submit"
          className="w-full rounded-full bg-basket-green px-6 py-3 text-sm font-medium text-white hover:bg-basket-green-dark"
        >
          Reset password
        </button>
      </form>
    </div>
  );
}
