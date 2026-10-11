"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import type { ActionResult } from "@/lib/admin/guard";
import { useAdminAction } from "../step-up";
import { Alert, Badge, Button, Card, Field, Input } from "../../_ui/kit";
import {
  addPasskeyOptions,
  addPasskeyVerify,
  changePassword,
  confirmTotpSetup,
  endMySession,
  regenerateRecoveryCodes,
  removePasskey,
  startTotpSetup,
  turnOffTotp,
} from "./actions";

type Passkey = { id: string; name: string; deviceType: string | null; backedUp: boolean; createdAt: string; lastUsedAt: string | null };
type Session = { id: string; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean };

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "Never";

/** "Chrome on Windows" from a user agent, without a parsing library. */
function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "an unknown system";
  return `${browser} on ${os}`;
}

export function SecurityView(props: { isOwner: boolean; passwordChangedAt: string | null; totp: boolean; recoveryLeft: number; passkeys: Passkey[]; sessions: Session[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  /** Runs an action, shows its outcome, and refreshes the page data on success. */
  const act = <T,>(fn: () => Promise<ActionResult<T>>, ok: string, then?: (data: T) => void) =>
    start(async () => {
      setNotice(null);
      const r = await run(fn);
      if (r.ok) {
        setNotice({ tone: "success", text: ok });
        then?.(r.data);
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {notice && (
        <div className="lg:col-span-2">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <PasskeysCard passkeys={props.passkeys} isOwner={props.isOwner} busy={pending} act={act} run={run} setNotice={setNotice} />

      <TotpCard enabled={props.totp} busy={pending} act={act} run={run} setNotice={setNotice} />

      <Card title="Recovery codes">
        <p className="text-[13px] text-carbon/65">
          For when you have neither your passkey nor your phone. Each works once. You have <b>{props.recoveryLeft}</b> left.
        </p>
        {props.recoveryLeft <= 3 && !codes && <div className="mt-3"><Alert tone="warn">You&apos;re running low. Make a new set and store it somewhere safe.</Alert></div>}
        {codes ? (
          <div className="mt-4 space-y-3">
            <Alert tone="warn">Save these now. They won&apos;t be shown again, and your old codes no longer work.</Alert>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-soft-mist/50 p-3 font-mono text-[14px] select-all">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button size="sm" variant="secondary" onClick={() => setCodes(null)}>
              I&apos;ve saved them
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Make ten new codes? Your current ones will stop working.")) act(() => regenerateRecoveryCodes(), "New recovery codes are ready.", (d) => setCodes(d.codes));
            }}
          >
            Make new codes
          </Button>
        )}
      </Card>

      <PasswordCard changedAt={props.passwordChangedAt} busy={pending} act={act} />

      <Card title="Where you're signed in" className="lg:col-span-2">
        <ul className="divide-y divide-black/5">
          {props.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px]">
              <div>
                <p className="font-semibold">
                  {device(s.userAgent)} {s.current && <Badge tone="good">This device</Badge>}
                </p>
                <p className="text-carbon/55">
                  {s.ip ?? "Unknown IP"} · signed in {when(s.createdAt)} · last active {when(s.lastSeenAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => endMySession(s.id), "That session has ended.")}>
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

type Act = <T>(fn: () => Promise<ActionResult<T>>, ok: string, then?: (data: T) => void) => void;
type Run = ReturnType<typeof useAdminAction>;
type SetNotice = (n: { tone: "error" | "success"; text: string } | null) => void;

function PasskeysCard({ passkeys, isOwner, busy, act, run, setNotice }: { passkeys: Passkey[]; isOwner: boolean; busy: boolean; act: Act; run: Run; setNotice: SetNotice }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    setNotice(null);
    try {
      const options = await run(() => addPasskeyOptions());
      if (!options.ok) {
        if (options.code !== "AUTH" && options.code !== "STEP_UP") setNotice({ tone: "error", text: options.error });
        return;
      }
      const response = await startRegistration({ optionsJSON: options.data });
      const r = await run(() => addPasskeyVerify(response, name || "Passkey"));
      if (r.ok) {
        setNotice({ tone: "success", text: "Passkey added. Your other devices were signed out." });
        setName("");
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    } catch {
      setNotice({ tone: "error", text: "The passkey prompt was closed or timed out. Nothing was added." });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card title="Passkeys">
      <p className="text-[13px] text-carbon/65">
        The strongest way in: your fingerprint, face or device PIN, tied to this site so it can&apos;t be phished.
        {isOwner && " As an Owner you must always keep at least one."}
      </p>
      <ul className="mt-3 divide-y divide-black/5">
        {passkeys.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <div>
              <p className="font-semibold">
                {p.name} {p.backedUp && <Badge>Synced</Badge>}
              </p>
              <p className="text-carbon/55">
                Added {when(p.createdAt)} · last used {when(p.lastUsedAt)}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Remove "${p.name}"? You won't be able to sign in with it.`)) act(() => removePasskey(p.id), "Passkey removed. Your other devices were signed out.");
              }}
            >
              Remove
            </Button>
          </li>
        ))}
        {passkeys.length === 0 && <li className="py-2.5 text-[13px] text-carbon/50">No passkeys yet.</li>}
      </ul>
      <div className="mt-4 flex gap-2">
        <Input aria-label="Passkey name" placeholder="Name it, e.g. Work laptop" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button variant="secondary" onClick={add} disabled={busy || adding} className="shrink-0">
          Add passkey
        </Button>
      </div>
    </Card>
  );
}

function TotpCard({ enabled, busy, act, run, setNotice }: { enabled: boolean; busy: boolean; act: Act; run: Run; setNotice: SetNotice }) {
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState("");

  const begin = async () => {
    setNotice(null);
    const r = await run(() => startTotpSetup());
    if (r.ok) setSetup(r.data);
    else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
  };

  return (
    <Card title="Authenticator app" actions={<Badge tone={enabled ? "good" : "neutral"}>{enabled ? "On" : "Off"}</Badge>}>
      <p className="text-[13px] text-carbon/65">A 6-digit code from Google Authenticator, 1Password, Authy or similar. A good backup to your passkey.</p>
      {setup ? (
        <div className="mt-4 space-y-3">
          <p className="text-[13px] text-carbon/70">Scan this with your app, then enter the code it shows.</p>
          {/* Server-generated SVG from our own otpauth URI: no user input reaches it. */}
          <div className="mx-auto w-44 rounded-xl bg-paper-white p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <p className="text-center text-[12px] text-carbon/55">
            Can&apos;t scan? Enter this key: <span className="font-mono break-all select-all">{setup.secret}</span>
          </p>
          <div className="flex gap-2">
            <Input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={7} />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={busy || code.replace(/\s/g, "").length !== 6}
              onClick={() =>
                act(() => confirmTotpSetup(code), "Authenticator app is on. Your other devices were signed out.", () => {
                  setSetup(null);
                  setCode("");
                })
              }
            >
              Turn on
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={begin}>
            {enabled ? "Move to a new phone" : "Set up"}
          </Button>
          {enabled && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Turn off your authenticator app?")) act(() => turnOffTotp(), "Authenticator app is off.");
              }}
            >
              Turn off
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function PasswordCard({ changedAt, busy, act }: { changedAt: string | null; busy: boolean; act: Act }) {
  const [key, setKey] = useState(0);
  return (
    <Card title="Password">
      <p className="text-[13px] text-carbon/65">Last changed {when(changedAt)}. At least 12 characters; a few unrelated words work well. Known-leaked passwords are refused.</p>
      <form
        key={key}
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next = String(f.get("next") ?? "");
          if (next !== String(f.get("confirm") ?? "")) return alert("The new passwords don't match.");
          act(() => changePassword({ current: String(f.get("current") ?? ""), next }), "Password changed. Your other devices were signed out.", () => setKey((k) => k + 1));
        }}
      >
        <Field label="Current password" htmlFor="pw-current">
          <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="New password" htmlFor="pw-next">
          <Input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        </Field>
        <Field label="New password again" htmlFor="pw-confirm">
          <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="sm" disabled={busy}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
