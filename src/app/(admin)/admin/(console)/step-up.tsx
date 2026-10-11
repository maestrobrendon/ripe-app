"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { ActionResult } from "@/lib/admin/guard";
import { stepUpMethods, stepUpPasskeyOptions, stepUpPasskeyVerify, stepUpTotp } from "./step-up-actions";
import { Alert, Button, Input } from "../_ui/kit";

/*
 * Runs an admin action, and if the server says "confirm it's you" (STEP_UP),
 * asks for a passkey or code, then runs it once more. Signed-out results send
 * you to sign in. Use: const run = useAdminAction(); await run(() => someAction(x)).
 */

type Runner = <T>(fn: () => Promise<ActionResult<T>>) => Promise<ActionResult<T>>;
const StepUpContext = createContext<Runner | null>(null);

export function useAdminAction(): Runner {
  const run = useContext(StepUpContext);
  if (!run) throw new Error("useAdminAction must be used inside <StepUpProvider>");
  return run;
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState<{ passkey: boolean; totp: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(async () => {
    setError(null);
    setCode("");
    setMethods(await stepUpMethods());
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const run: Runner = useCallback(
    async (fn) => {
      let result = await fn();
      if (!result.ok && result.code === "STEP_UP" && (await ask())) result = await fn();
      if (!result.ok && result.code === "AUTH") router.replace("/login");
      return result;
    },
    [ask, router],
  );

  const passkey = async () => {
    setBusy(true);
    setError(null);
    try {
      const options = await stepUpPasskeyOptions();
      if (!options) throw new Error();
      const r = await stepUpPasskeyVerify(await startAuthentication({ optionsJSON: options }));
      if (r.ok) close(true);
      else setError(r.error ?? "That didn't work.");
    } catch {
      setError("The passkey prompt was closed or timed out.");
    } finally {
      setBusy(false);
    }
  };

  const totp = async () => {
    setBusy(true);
    const r = await stepUpTotp(code);
    setBusy(false);
    if (r.ok) close(true);
    else setError(r.error ?? "That didn't work.");
  };

  return (
    <StepUpContext.Provider value={run}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-carbon/40 px-4" role="dialog" aria-modal="true" aria-labelledby="stepup-title">
          <div className="w-full max-w-sm rounded-2xl bg-paper-white p-6 shadow-xl">
            <h2 id="stepup-title" className="text-[17px] font-semibold">
              Confirm it&apos;s you
            </h2>
            <p className="mt-1 text-[13px] text-carbon/60">This action is protected. Confirm once and you won&apos;t be asked again for 10 minutes.</p>
            <div className="mt-5 space-y-3">
              {error && <Alert tone="error">{error}</Alert>}
              {methods?.passkey && (
                <Button onClick={passkey} disabled={busy} className="w-full">
                  Use your passkey
                </Button>
              )}
              {methods?.totp && (
                <div className="flex gap-2">
                  <Input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={7} />
                  <Button variant="secondary" onClick={totp} disabled={busy || code.replace(/\s/g, "").length !== 6}>
                    Verify
                  </Button>
                </div>
              )}
              <Button variant="ghost" onClick={() => close(false)} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </StepUpContext.Provider>
  );
}
