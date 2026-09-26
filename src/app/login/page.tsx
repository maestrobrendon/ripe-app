import Link from "next/link";
import { safeNextPath } from "@/lib/safe-redirect";
import { PasswordField } from "@/components/ui/password-field";
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
        <p className="mt-4 rounded-input border border-border bg-ember/12 p-3 text-sm text-carbon">
          Too many sign-in attempts. Please wait a few minutes and try again.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-input border border-border bg-ember/12 p-3 text-sm text-carbon">
          That email or phone and password did not match.
        </p>
      ) : null}

      <form action={signIn} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email or phone</span>
          <input name="contact" required className="w-full rounded-input border border-border px-3 py-2 text-sm" />
        </label>
        <PasswordField
          name="password"
          label="Password"
          required
          labelExtra={
            <Link href="/forgot-password" className="text-xs font-normal text-carbon underline">
              Forgot password?
            </Link>
          }
        />
        <button
          type="submit"
          className="w-full rounded-full bg-carbon px-6 py-3 text-sm font-medium text-white hover:bg-carbon/85"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        New here?{" "}
        <Link href="/start" className="text-carbon underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
