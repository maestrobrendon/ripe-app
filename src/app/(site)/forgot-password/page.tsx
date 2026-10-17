import Link from "next/link";
import { AuthShell, authInput, authPrimaryButton } from "@/components/auth-shell";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <AuthShell
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={sent ? undefined : "Enter the email on your account and we will send you a link to reset your password."}
      photo="kitchen"
    >
      {sent ? (
        <div className="mt-6 rounded-xl bg-sky-wash p-4 text-sm leading-relaxed">
          <p>If that email matches a Basket account, we have sent a link to reset your password. It expires in 30 minutes.</p>
          <p className="mt-2 text-carbon/60">
            Signed up with a phone number only? Email reset is not available yet for phone-only accounts. Message us on WhatsApp and we&apos;ll help.
          </p>
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
