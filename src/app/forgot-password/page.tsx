import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Reset your password</h1>

      {sent ? (
        <div className="mt-6 rounded-lg border border-ripe-green bg-ripe-green-light p-4 text-sm">
          <p>
            If that email matches a Ripe account, we have sent a link to reset your password.
            It expires in 30 minutes.
          </p>
          <p className="mt-2 text-muted">
            Signed up with a phone number only? Email reset is not available yet for
            phone-only accounts. <Link href="/login" className="text-ripe-green underline">Contact us</Link> for help.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">
            Enter the email on your account and we will send you a link to reset your password.
          </p>
          <form action={requestPasswordReset} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <input
                name="contact"
                type="email"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark"
            >
              Send reset link
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="text-ripe-green underline">Back to sign in</Link>
      </p>
    </div>
  );
}
