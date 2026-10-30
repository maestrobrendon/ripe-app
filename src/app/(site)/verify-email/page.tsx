import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { hasLiveCode, verifyEmailToken } from "@/lib/email-verification";
import { CodeEntry } from "./resend-button";

export const metadata = { title: "Confirm your email. BasketNG", robots: { index: false } };

/**
 * Where a signed-in customer types the 6-digit code from their email (or
 * asks for one), and where the email's one-tap link lands (?token=…).
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await getCurrentUser();
  const result = token ? await verifyEmailToken(token.slice(0, 100)) : null;
  const waiting = !!user?.email && !user.emailVerifiedAt && !result?.ok;
  const codeSent = waiting && !result ? await hasLiveCode(user.id) : false;

  const title = result?.ok
    ? "Your email is confirmed."
    : result?.reason === "expired"
      ? "That link has expired."
      : result?.reason === "changed"
        ? "Your email has changed since."
        : result
          ? "That link doesn't work."
          : user?.emailVerifiedAt
            ? "Your email is confirmed."
            : codeSent
              ? "Enter your code"
              : "Confirm your email";
  const body = result?.ok
    ? `Receipts and basket reminders will reach ${result.email}.`
    : result
      ? user?.email && !user.emailVerifiedAt
        ? "Send yourself a code instead and type it here."
        : "Sign in, then send yourself a new code from the Me page."
      : user?.emailVerifiedAt
        ? `We send receipts and reminders to ${user.email}.`
        : user?.email
          ? codeSent
            ? `We emailed a 6-digit code to ${user.email}. It works for 30 minutes.`
            : `So your receipts and basket reminders reach ${user.email}.`
          : "Add an email on the Me page first.";

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[56px] leading-none" aria-hidden>
        {result?.ok || (!result && user?.emailVerifiedAt) ? "✅" : "✉️"}
      </p>
      <h1 className="mt-5 text-[28px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-[16px] leading-snug text-muted">{body}</p>
      <div className="mt-8 grid w-full gap-2.5">
        {waiting && user?.email && <CodeEntry email={user.email} codeSent={codeSent} />}
        <Link href={user ? "/account" : "/login"} className="flex h-12 items-center justify-center rounded-full bg-black/5 text-[15px] font-semibold">
          {user ? "Back to Me" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
