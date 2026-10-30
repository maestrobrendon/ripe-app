"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { passkeySignInOptions, passkeySignInVerify, recoverySignInAction, signOutAction, totpSignInAction, type FormState } from "../../actions";
import { Alert, Button, Field, Input } from "../../../_ui/kit";

export function VerifyChoices({ hasPasskey, hasTotp, hasRecovery }: { hasPasskey: boolean; hasTotp: boolean; hasRecovery: boolean }) {
  const [mode, setMode] = useState<"passkey" | "totp" | "recovery">(hasPasskey ? "passkey" : hasTotp ? "totp" : "recovery");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [totpState, totpAction, totpPending] = useActionState<FormState, FormData>(totpSignInAction, undefined);
  const [recState, recAction, recPending] = useActionState<FormState, FormData>(recoverySignInAction, undefined);

  const usePasskey = () =>
    startTransition(async () => {
      setPasskeyError(null);
      try {
        const options = await passkeySignInOptions();
        if (!options) return setPasskeyError("No passkey is set up on this account.");
        const response = await startAuthentication({ optionsJSON: options });
        const result = await passkeySignInVerify(response);
        if (result.ok) router.replace("/");
        else setPasskeyError(result.error ?? "That didn't work.");
      } catch {
        setPasskeyError("No passkey came back. Passkeys made before the admin moved to admin.getbasket.ng don't work here: use a recovery code, then add a new passkey under Security.");
      }
    });

  return (
    <div className="space-y-5">
      {mode === "passkey" && (
        <div className="space-y-3">
          {passkeyError && <Alert tone="error">{passkeyError}</Alert>}
          <Button onClick={usePasskey} disabled={pending} className="w-full">
            {pending ? "Waiting for your passkey…" : "Use your passkey"}
          </Button>
          <p className="text-[13px] text-carbon/55">Face ID, fingerprint, Windows Hello or a security key.</p>
        </div>
      )}

      {mode === "totp" && (
        <form action={totpAction} className="space-y-4">
          {totpState?.error && <Alert tone="error">{totpState.error}</Alert>}
          <Field label="Code from your authenticator app" htmlFor="code">
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
          </Field>
          <Button type="submit" disabled={totpPending} className="w-full">
            {totpPending ? "Checking…" : "Verify"}
          </Button>
        </form>
      )}

      {mode === "recovery" && (
        <form action={recAction} className="space-y-4">
          {recState?.error && <Alert tone="error">{recState.error}</Alert>}
          <Field label="Recovery code" htmlFor="rcode" hint="Each code works once. The Owners are notified when one is used.">
            <Input id="rcode" name="code" autoComplete="off" spellCheck={false} placeholder="XXXXX-XXXXX" required autoFocus />
          </Field>
          <Button type="submit" disabled={recPending} className="w-full">
            {recPending ? "Checking…" : "Verify"}
          </Button>
        </form>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-black/6 pt-4 text-[13px]">
        {hasPasskey && mode !== "passkey" && (
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setMode("passkey")}>
            Use a passkey
          </button>
        )}
        {hasTotp && mode !== "totp" && (
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setMode("totp")}>
            Use an authenticator code
          </button>
        )}
        {hasRecovery && mode !== "recovery" && (
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setMode("recovery")}>
            Use a recovery code
          </button>
        )}
        <form action={signOutAction} className="ml-auto">
          <button type="submit" className="text-carbon/55 hover:text-carbon">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
