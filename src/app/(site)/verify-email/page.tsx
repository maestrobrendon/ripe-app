import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { verifyEmailToken } from "@/lib/email-verification";
import { ResendButton } from "./resend-button";

export const metadata = { title: "Confirm your email. BasketNG", robots: { index: false } };

/**
 * Where the emailed link lands (?token=…), and, with no token, where a
 * signed-in customer asks for a new link.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await getCurrentUser();
  const result = token ? await verifyEmailToken(token.slice(0, 100)) : null;

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
            : "Confirm your email";
  const body = result?.ok
    ? `Receipts and basket reminders will reach ${result.email}.`
    : result
      ? "Send yourself a new link below and open the newest one."
      : user?.emailVerifiedAt
        ? `We send receipts and reminders to ${user.email}.`
        : user?.email
          ? `We'll send a link to ${user.email}. Open it on any device.`
          : "Add an email on the Me page first.";

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[56px] leading-none" aria-hidden>
        {result?.ok || (!result && user?.emailVerifiedAt) ? "✅" : "✉️"}
      </p>
      <h1 className="mt-5 text-[28px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-[16px] leading-snug text-muted">{body}</p>
      <div className="mt-8 grid w-full gap-2.5">
        {user && user.email && !user.emailVerifiedAt && !result?.ok && <ResendButton />}
        <Link href={user ? "/account" : "/login"} className="flex h-12 items-center justify-center rounded-full bg-black/5 text-[15px] font-semibold">
          {user ? "Back to Me" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
