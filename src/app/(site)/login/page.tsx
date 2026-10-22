import Link from "next/link";
import { safeNextPath } from "@/lib/safe-redirect";
import { PasswordField } from "@/components/ui/password-field";
import { AuthAlert, AuthShell, authInput, authPrimaryButton, authSecondaryButton } from "@/components/auth-shell";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; from?: string }>;
}) {
  const { error, next: nextRaw, from } = await searchParams;
  const next = safeNextPath(nextRaw, "");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your basket, your recipes and your next delivery.">
      {error === "throttled" ? (
        <AuthAlert>Too many sign-in attempts. Please wait a few minutes and try again.</AuthAlert>
      ) : error === "suspended" ? (
        <AuthAlert>This account is paused. Message us on WhatsApp and we&apos;ll help you sort it out.</AuthAlert>
      ) : error ? (
        <AuthAlert>That email or phone and password did not match.</AuthAlert>
      ) : null}

      <form action={signIn} className="mt-8 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        {from === "checkout" && <input type="hidden" name="from" value="checkout" />}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email or phone</span>
          <input name="contact" required autoComplete="username" placeholder="you@example.com or 0803…" className={authInput} />
        </label>
        <PasswordField
          name="password"
          label="Password"
          required
          autoComplete="current-password"
          labelExtra={
            <Link href="/forgot-password" className="text-[13px] font-medium text-carbon/70 underline decoration-carbon/25 underline-offset-4 hover:text-carbon">
              Forgot password?
            </Link>
          }
        />
        <button type="submit" className={authPrimaryButton}>
          Sign in
        </button>
      </form>

      <div className="my-7 flex items-center gap-3 text-[13px] text-carbon/45">
        <span className="h-px flex-1 bg-border" />
        New to Basket?
        <span className="h-px flex-1 bg-border" />
      </div>
      {/* From checkout's "I already have an account": making one instead keeps the checkout sign-up. */}
      <Link href={from === "checkout" ? "/start?from=checkout&next=/checkout" : "/start"} className={authSecondaryButton}>
        Create an account
      </Link>

      <p className="mt-8 text-[13px] leading-relaxed text-carbon/45">
        By signing in you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-carbon">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-carbon">
          Privacy policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}
