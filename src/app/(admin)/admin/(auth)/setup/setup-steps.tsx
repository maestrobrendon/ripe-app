"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { finishSetupAction, setupPasskeyOptions, setupPasskeyVerify, setupRecoveryCodes, setupTotpBegin, setupTotpConfirm } from "../actions";
import { Alert, Button, Field, Input } from "../../_ui/kit";

/** Two steps: a second factor, then recovery codes saved somewhere safe. */
export function SetupSteps({ owner, factorDone, hasPasskey }: { owner: boolean; factorDone: boolean; hasPasskey: boolean }) {
  // Which second factor is in place; seeded from the server so a reload shows the truth.
  const [method, setMethod] = useState<"passkey" | "totp" | null>(hasPasskey ? "passkey" : factorDone ? "totp" : null);
  const done = method !== null;
  const [error, setError] = useState<string | null>(null);
  const [totp, setTotp] = useState<{ qrSvg: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const addPasskey = () =>
    start(async () => {
      setError(null);
      try {
        const options = await setupPasskeyOptions();
        const response = await startRegistration({ optionsJSON: options });
        const result = await setupPasskeyVerify(response, guessDeviceName());
        if (result.ok) setMethod("passkey");
        else setError(result.error ?? "That didn't work.");
      } catch {
        setError("The passkey prompt was closed or isn't supported on this device.");
      }
    });

  const beginTotp = () =>
    start(async () => {
      setError(null);
      setTotp(await setupTotpBegin());
    });

  const confirmTotp = () =>
    start(async () => {
      const r = await setupTotpConfirm(code);
      if (r.ok) setMethod("totp");
      else setError(r.error ?? "That didn't work.");
    });

  const showCodes = () =>
    start(async () => {
      const r = await setupRecoveryCodes();
      if (r.ok && r.codes) setCodes(r.codes);
      else setError(r.error ?? "That didn't work.");
    });

  const finish = () =>
    start(async () => {
      const r = await finishSetupAction();
      if (r.ok) router.replace("/");
      else setError(r.error ?? "That didn't work.");
    });

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <ol className="space-y-5">
        <li>
          <p className="text-[13px] font-semibold text-carbon/55">Step 1</p>
          <p className="text-[15px] font-semibold">{owner ? "Add a passkey" : "Add a second factor"}</p>
          {done ? (
            <Alert tone="success">{method === "passkey" ? "Passkey saved." : "Authenticator app connected."}</Alert>
          ) : (
            <div className="mt-3 space-y-3">
              <Button onClick={addPasskey} disabled={pending} className="w-full">
                Add a passkey
              </Button>
              {!owner && !totp && (
                <Button variant="secondary" onClick={beginTotp} disabled={pending} className="w-full">
                  Use an authenticator app instead
                </Button>
              )}
              {totp && (
                <div className="space-y-3 rounded-xl bg-soft-mist/50 p-4">
                  <p className="text-[13px]">Scan this with Google Authenticator, 1Password, Authy or similar.</p>
                  {/* The SVG is generated on the server by the qrcode library from our own otpauth URI. */}
                  <div className="mx-auto w-44 rounded-lg bg-paper-white p-2" dangerouslySetInnerHTML={{ __html: totp.qrSvg }} />
                  <p className="text-[12px] break-all text-carbon/60">
                    Can&apos;t scan? Enter this key: <code className="font-mono text-carbon">{totp.secret}</code>
                  </p>
                  <Field label="6-digit code from the app" htmlFor="totp">
                    <Input id="totp" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={7} />
                  </Field>
                  <Button onClick={confirmTotp} disabled={pending || code.replace(/\s/g, "").length !== 6} className="w-full">
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          )}
        </li>

        <li className={done ? "" : "pointer-events-none opacity-40"}>
          <p className="text-[13px] font-semibold text-carbon/55">Step 2</p>
          <p className="text-[15px] font-semibold">Save your recovery codes</p>
          <p className="mt-1 text-[13px] text-carbon/60">If you lose your device, each code gets you in once. Keep them in a password manager, not on this computer&apos;s desktop.</p>
          {!codes ? (
            <Button variant="secondary" onClick={showCodes} disabled={!done || pending} className="mt-3 w-full">
              Show my recovery codes
            </Button>
          ) : (
            <div className="mt-3 space-y-3">
              <ul className="grid grid-cols-2 gap-2 rounded-xl bg-soft-mist/50 p-4 font-mono text-[14px]">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(codes.join("\n"));
                }}
              >
                Copy all
              </Button>
              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5" />
                I&apos;ve saved these somewhere safe. They won&apos;t be shown again.
              </label>
              <Button onClick={finish} disabled={!saved || pending} className="w-full">
                Finish and open the admin
              </Button>
            </div>
          )}
        </li>
      </ol>
    </div>
  );
}

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Passkey";
}
