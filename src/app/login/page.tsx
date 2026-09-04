import Link from "next/link";
import { safeNextPath } from "@/lib/safe-redirect";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: nextRaw } = await searchParams;
  const next = safeNextPath(nextRaw, "");

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Sign in</h1>

      {error === "throttled" ? (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          Too many sign-in attempts. Please wait a few minutes and try again.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          That email or phone and password did not match.
        </p>
      ) : null}

      <form action={signIn} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email or phone</span>
          <input name="contact" required className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-sm font-medium">
            Password
            <Link href="/forgot-password" className="text-xs font-normal text-ripe-green underline">
              Forgot password?
            </Link>
          </span>
          <input name="password" type="password" required className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        New here?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-ripe-green underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
