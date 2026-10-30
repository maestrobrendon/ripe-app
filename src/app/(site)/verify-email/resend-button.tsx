"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCode, resendVerification } from "./actions";

/**
 * Confirming by code, one thing at a time: send a code, then type it. The
 * field fills from the iPhone/Android keyboard suggestion and submits itself
 * at the sixth digit, so most people never press a button.
 */
export function CodeEntry({ email, codeSent }: { email: string; codeSent: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState(codeSent);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [sending, startSend] = useTransition();
  const [checking, startCheck] = useTransition();

  const send = () =>
    startSend(async () => {
      const r = await resendVerification();
      if (r.ok) {
        setSent(true);
        setCode("");
        setMessage({ text: `New code sent to ${r.email}.`, error: false });
        requestAnimationFrame(() => input.current?.focus());
      } else setMessage({ text: r.error, error: true });
    });

  const check = (value: string) =>
    startCheck(async () => {
      const r = await confirmCode(value);
      if (r.ok) router.replace("/account?toast=email-verified");
      else {
        setMessage({ text: r.error, error: true });
        setCode("");
        input.current?.focus();
      }
    });

  if (!sent) {
    return (
      <div>
        <button type="button" disabled={sending} onClick={send} className="flex h-12 w-full items-center justify-center rounded-full bg-carbon text-[15px] font-semibold text-paper-white disabled:opacity-60">
          {sending ? "Sending…" : "Send me a code"}
        </button>
        {message && <p role="status" className="mt-3 text-[14px] text-ember">{message.text}</p>}
        <p className="mt-3 text-[13px] text-muted">We&apos;ll email a 6-digit code to {email}.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) check(code);
      }}
    >
      <label htmlFor="email-code" className="sr-only">
        6-digit code
      </label>
      <input
        ref={input}
        id="email-code"
        value={code}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(next);
          setMessage(null);
          if (next.length === 6) check(next);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        disabled={checking}
        placeholder="••••••"
        className="h-16 w-full rounded-2xl bg-paper-white text-center font-display text-[32px] tracking-[0.35em] shadow-[0_0_0_1px_#000] outline-none placeholder:text-black/20 focus:shadow-[0_0_0_2px_#000] disabled:opacity-60"
      />
      {message && (
        <p role="status" className={`mt-3 text-[14px] ${message.error ? "text-ember" : "text-muted"}`}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={checking || code.length !== 6} className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-carbon text-[15px] font-semibold text-paper-white disabled:opacity-40">
        {checking ? "Checking…" : "Confirm"}
      </button>
      <button type="button" disabled={sending} onClick={send} className="mt-2.5 h-11 w-full text-[14px] font-semibold underline underline-offset-4 disabled:opacity-60">
        {sending ? "Sending…" : "Send a new code"}
      </button>
    </form>
  );
}
