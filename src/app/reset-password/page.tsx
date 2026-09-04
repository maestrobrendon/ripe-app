import Link from "next/link";
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
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-ripe-green underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>

      {error === "expired" ? (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          That link has expired or was already used. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </p>
      ) : error === "throttled" ? (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          Too many attempts. Please wait a few minutes and try again.
        </p>
      ) : error === "invalid" ? (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          Passwords must be at least 8 characters and match.
        </p>
      ) : null}

      <form action={resetPassword} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={200}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Confirm password</span>
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            maxLength={200}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark"
        >
          Reset password
        </button>
      </form>
    </div>
  );
}
