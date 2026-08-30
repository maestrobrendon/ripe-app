import Link from "next/link";
import { createAccount } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-3 text-sm text-muted">
        An account saves your addresses, order history and preferences, and lets the trained assistant
        suggest things you will actually eat. It is free and separate from any subscription.
      </p>

      {error === "exists" && (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          An account already uses that email or phone. <Link href="/login" className="underline">Sign in</Link> instead.
        </p>
      )}
      {error === "missing" && (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          Enter your name, an email or phone, and a password of at least 8 characters.
        </p>
      )}

      <form action={createAccount} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Full name</span>
          <input name="name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email or phone</span>
          <input name="contact" required className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="you@example.com or 080..." />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input name="password" type="password" required minLength={8} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-ripe-green underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
