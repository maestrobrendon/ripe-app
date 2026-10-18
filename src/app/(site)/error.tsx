"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWhatsappHref, useSupportVerb } from "@/components/support-links";

/** When a page fails: say so plainly, offer to try again, and a person if that doesn't work. */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const help = useWhatsappHref(`Hi, a Basket page didn't load for me.${error.digest ? ` (ref ${error.digest})` : ""}`);
  const verb = useSupportVerb();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <p className="text-4xl" aria-hidden>
        🥕
      </p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">That didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">It&apos;s usually the connection. Nothing in your order was lost.</p>
      <div className="mt-6 grid gap-2">
        <button type="button" onClick={() => retry()} className="h-12 rounded-full bg-carbon font-semibold text-paper-white">
          Try again
        </button>
        <Link href="/basket" className="flex h-12 items-center justify-center rounded-full border border-border font-semibold">
          Go to Home
        </Link>
      </div>
      <p className="mt-5 text-xs text-muted">
        Still stuck?{" "}
        <a href={help} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
          {verb}
        </a>
        {error.digest ? ` and mention ${error.digest}.` : "."}
      </p>
    </div>
  );
}
