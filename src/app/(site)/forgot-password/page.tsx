import Link from "next/link";
import { AuthShell, authInput, authPrimaryButton } from "@/components/auth-shell";
import { requestPasswordReset } from "./actions";
import { getSiteSettings } from "@/lib/site-settings";
import { supportHref, supportVerb } from "@/lib/support";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const [{ sent }, settings] = await Promise.all([searchParams, getSiteSettings()]);
  // Phone-only accounts: there's no SMS yet, so a person sends the link.
  const phoneHelp = supportHref(settings.support, "Hi, I signed up to Basket with my phone number and need a link to reset my password. My number is ", "Password reset for a phone-only account");
  const phoneHelpLine = (
    <p className="mt-2 text-carbon/60">
      Signed up with a phone number only?{" "}
      <a href={phoneHelp} target="_blank" rel="noreferrer" className="font-semibold text-carbon underline underline-offset-2">
        {supportVerb(settings.support)}
      </a>{" "}
      and we&apos;ll send you a link that works once, for 30 minutes.
    </p>
  );

  return (
    <AuthShell
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={sent ? undefined : "Enter the email on your account and we will send you a link to reset your password."}
      photo="kitchen"
    >
      {sent ? (
        <div className="mt-6 rounded-xl bg-sky-wash p-4 text-sm leading-relaxed">
          <p>If that email matches a Basket account, we have sent a link to reset your password. It expires in 30 minutes.</p>
          {phoneHelpLine}
        </div>
      ) : (
        <form action={requestPasswordReset} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input name="contact" type="email" required autoComplete="email" placeholder="you@example.com" className={authInput} />
          </label>
          <button type="submit" className={authPrimaryButton}>
            Send reset link
          </button>
          <div className="text-sm">{phoneHelpLine}</div>
        </form>
      )}

      <p className="mt-7 text-sm">
        <Link href="/login" className="font-medium text-carbon underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
