"use client";

import { useState, useTransition } from "react";
import { resendVerification } from "./actions";

/** Sends a new confirmation link, and says where it went. */
export function ResendButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resendVerification();
            setMessage(r.ok ? `Sent. Check ${r.email} (and spam), then open the link.` : r.error);
          })
        }
        className="flex h-12 w-full items-center justify-center rounded-full bg-carbon text-[15px] font-semibold text-paper-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send me a link"}
      </button>
      {message && (
        <p role="status" className="mt-3 text-[14px] text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
