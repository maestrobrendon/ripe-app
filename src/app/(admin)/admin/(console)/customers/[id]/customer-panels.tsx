"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/guard";
import { useAdminAction } from "../../step-up";
import { Alert, Button, Card, Field, Input } from "../../../_ui/kit";
import {
  addCustomerNote,
  decidePlanRequest,
  eraseCustomer,
  revealCustomerContact,
  sendCustomerPasswordReset,
  createCustomerResetLink,
  setCustomerPlan,
  setCustomerSuspended,
  signOutCustomer,
} from "../actions";

type Notice = { tone: "error" | "success"; text: string } | null;
const selectClass = "h-9 w-full rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

function useRun() {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const go = <T,>(fn: () => Promise<ActionResult<T>>, ok: string | ((d: T) => string), then?: (d: T) => void) =>
    start(async () => {
      setNotice(null);
      const r = await run(fn);
      if (r.ok) {
        setNotice({ tone: "success", text: typeof ok === "function" ? ok(r.data) : ok });
        then?.(r.data);
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });
  const banner = notice && (
    <div className="mt-3">
      <Alert tone={notice.tone}>{notice.text}</Alert>
    </div>
  );
  return { go, pending, banner };
}

export function ContactCard({ userId, masked, canReveal }: { userId: string; masked: { email: string; phone: string; address: string }; canReveal: boolean }) {
  const { go, pending, banner } = useRun();
  const [shown, setShown] = useState<{ email: string | null; phone: string | null; address: string | null } | null>(null);
  return (
    <Card title="Contact">
      <dl className="space-y-2 text-[13px]">
        <div>
          <dt className="text-carbon/50">Email</dt>
          <dd className="break-all">{shown ? (shown.email ?? "—") : masked.email}</dd>
        </div>
        <div>
          <dt className="text-carbon/50">Phone</dt>
          <dd className="tabular-nums">{shown ? (shown.phone ?? "—") : masked.phone}</dd>
        </div>
        <div>
          <dt className="text-carbon/50">Address</dt>
          <dd className="whitespace-pre-line">{shown ? (shown.address ?? "—") : masked.address}</dd>
        </div>
      </dl>
      {canReveal && !shown && (
        <Button size="sm" variant="secondary" className="mt-3" disabled={pending} onClick={() => go(() => revealCustomerContact(userId), "Shown and recorded in the audit log.", setShown)}>
          Show contact details
        </Button>
      )}
      {banner}
    </Card>
  );
}

export function PlanCard(props: {
  userId: string;
  current: { slug: string; name: string; since: string | null } | null;
  deliveryDay: string | null;
  tiers: { slug: string; label: string }[];
  requests: { id: string; tierName: string; fee: string; at: string }[];
  canChange: boolean;
  canDecide: boolean;
}) {
  const { go, pending, banner } = useRun();
  const [editing, setEditing] = useState(false);
  return (
    <Card title="Plan">
      <p className="text-[14px] font-semibold">{props.current?.name ?? "Pay as you go"}</p>
      {props.current && (
        <p className="text-[13px] text-carbon/60">
          {props.current.since ? `Since ${props.current.since}` : "Start date not recorded"}
          {props.deliveryDay && ` · delivers ${props.deliveryDay}`}
        </p>
      )}

      {props.requests.map((r) => (
        <div key={r.id} className="mt-3 rounded-xl bg-sunburst/20 p-3 text-[13px]">
          <p>
            Asked to join <b className="font-semibold">{r.tierName}</b> ({r.fee}/month), {r.at}.
          </p>
          {props.canDecide ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => go(() => decidePlanRequest({ requestId: r.id, approve: true }), "Approved. They're on the plan and have been emailed.")}>
                Payment received, approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  const note = window.prompt("Why is it declined? The customer sees this.") ?? "";
                  if (note.trim()) go(() => decidePlanRequest({ requestId: r.id, approve: false, note }), "Declined. The customer has been emailed.");
                }}
              >
                Decline
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-carbon/55">Finance approves this once payment is in.</p>
          )}
        </div>
      ))}

      {props.canChange &&
        (editing ? (
          <form
            className="mt-3 space-y-2 border-t border-black/6 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const slug = String(f.get("tier") ?? "");
              go(() => setCustomerPlan({ userId: props.userId, tierSlug: slug || null, reason: String(f.get("reason") ?? "") }), "Plan changed.", () => setEditing(false));
            }}
          >
            <select name="tier" defaultValue={props.current?.slug ?? ""} aria-label="Plan" className={selectClass}>
              <option value="">Pay as you go</option>
              {props.tiers.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
            <Input name="reason" required maxLength={300} placeholder="Why? e.g. Paid by transfer, ref 1234" aria-label="Reason" className="h-9! text-[13px]!" />
            <div className="flex gap-2">
              <Button size="sm" disabled={pending}>
                Save plan
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => setEditing(true)}>
            Change plan
          </Button>
        ))}
      {banner}
    </Card>
  );
}

export function NotesCard({ userId, canAdd, notes }: { userId: string; canAdd: boolean; notes: { id: string; body: string; staffName: string; at: string }[] }) {
  const { go, pending, banner } = useRun();
  const [body, setBody] = useState("");
  return (
    <Card title="Staff notes">
      <p className="-mt-2 mb-3 text-[12px] text-carbon/55">For whoever helps this customer next. Never shown to them, but included if they ask for their data.</p>
      {canAdd && (
        <form
          className="mb-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => addCustomerNote({ userId, body }), "Note added.", () => setBody(""));
          }}
        >
          <textarea
            aria-label="New note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="e.g. Prefers deliveries after 4pm; gate code with security"
            className="w-full rounded-xl bg-paper-white p-3 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]"
          />
          <Button size="sm" variant="secondary" disabled={pending || !body.trim()}>
            Add note
          </Button>
        </form>
      )}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="text-[13px]">
            <p className="whitespace-pre-line">{n.body}</p>
            <p className="mt-0.5 text-[12px] text-carbon/50">
              {n.staffName} · {n.at}
            </p>
          </li>
        ))}
        {notes.length === 0 && <li className="text-[13px] text-carbon/50">No notes yet.</li>}
      </ul>
      {banner}
    </Card>
  );
}

export function AccountControls({ userId, suspended, hasEmail, sessions, canManage }: { userId: string; suspended: boolean; hasEmail: boolean; sessions: number; canManage: boolean }) {
  const { go, pending, banner } = useRun();
  const [resetLink, setResetLink] = useState<{ link: string; phone: string | null } | null>(null);
  if (!canManage) return null;
  const waText = resetLink ? encodeURIComponent(`Hi, it's Basket. Here's your link to set a new password. It works once, for 30 minutes: ${resetLink.link}`) : "";
  return (
    <Card title="Account">
      <div className="flex flex-col items-start gap-1">
        {hasEmail ? (
          <Button size="sm" variant="ghost" className="-ml-3" disabled={pending} onClick={() => go(() => sendCustomerPasswordReset(userId), "Password reset link sent to their email.")}>
            Send a password reset link
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="-ml-3" disabled={pending} onClick={() => go(() => createCustomerResetLink(userId), "Link made. Send it on WhatsApp; it works once, for 30 minutes.", setResetLink)}>
            Make a password reset link to send on WhatsApp
          </Button>
        )}
        {resetLink && (
          <div className="mb-2 w-full rounded-lg bg-soft-mist p-2.5 text-[12px]">
            <p className="break-all tabular-nums">{resetLink.link}</p>
            <div className="mt-2 flex gap-3">
              <button type="button" className="font-semibold underline" onClick={() => navigator.clipboard?.writeText(resetLink.link)}>
                Copy
              </button>
              {resetLink.phone && (
                <a className="font-semibold underline" target="_blank" rel="noreferrer" href={`https://wa.me/${resetLink.phone.replace(/\D/g, "")}?text=${waText}`}>
                  Open WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
        {sessions > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="-ml-3"
            disabled={pending}
            onClick={() => go(() => signOutCustomer(userId), (d) => `Signed out of ${d.count} device${d.count === 1 ? "" : "s"}.`)}
          >
            Sign out of every device
          </Button>
        )}
        {suspended ? (
          <Button size="sm" variant="ghost" className="-ml-3" disabled={pending} onClick={() => go(() => setCustomerSuspended({ userId, suspend: false }), "Account restored. They can sign in again.")}>
            Restore account
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="-ml-3 text-[#9a2c00]"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Why pause this account? Only staff see this.") ?? "";
              if (reason.trim()) go(() => setCustomerSuspended({ userId, suspend: true, reason }), "Account paused and signed out everywhere.");
            }}
          >
            Pause account
          </Button>
        )}
      </div>
      {banner}
    </Card>
  );
}

export function DataControls({ userId, name, erased, canExport, canErase }: { userId: string; name: string; erased: boolean; canExport: boolean; canErase: boolean }) {
  const { go, pending, banner } = useRun();
  const run = useAdminAction();
  const [confirming, setConfirming] = useState(false);
  if (!canExport && !canErase) return null;

  // The export is a download from a protected route; ask for a fresh second
  // factor first by running a no-op through the step-up runner.
  const download = async () => {
    const r = await run(async () => {
      const res = await fetch(`/customers/${userId}/export`, { method: "HEAD", credentials: "same-origin" });
      if (res.status === 428) return { ok: false as const, code: "STEP_UP" as const, error: "Confirm it's you" };
      if (!res.ok) return { ok: false as const, code: "FORBIDDEN" as const, error: "You can't export this customer's data." };
      return { ok: true as const, data: undefined };
    });
    if (!r.ok) return;
    // A real link click, so the browser downloads the file instead of routing.
    const a = document.createElement("a");
    a.href = `/customers/${userId}/export`;
    a.download = "";
    a.click();
  };

  return (
    <Card title="Their data">
      <p className="text-[12px] text-carbon/55">For requests under the Nigeria Data Protection Act. Both are recorded.</p>
      <div className="mt-3 flex flex-col items-start gap-1">
        {canExport && !erased && (
          <Button size="sm" variant="ghost" className="-ml-3" onClick={download}>
            Download everything we hold (JSON)
          </Button>
        )}
        {canErase && !erased && !confirming && (
          <Button size="sm" variant="ghost" className="-ml-3 text-[#9a2c00]" onClick={() => setConfirming(true)}>
            Erase their personal data
          </Button>
        )}
      </div>
      {confirming && (
        <form
          className="mt-3 space-y-2 border-t border-black/6 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => eraseCustomer({ userId, confirm: String(new FormData(e.currentTarget).get("confirm") ?? "") }), "Personal data erased.", () => setConfirming(false));
          }}
        >
          <Alert tone="warn">
            This deletes their account details, baskets, plans, chats and notes, and strips their name and contact details from past orders. It can&apos;t be undone.
          </Alert>
          <Field label={`Type "${name}" to confirm`} htmlFor="erase-confirm">
            <Input id="erase-confirm" name="confirm" autoComplete="off" required className="h-9! text-[13px]!" />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={pending}>
              Erase permanently
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        </form>
      )}
      {banner}
    </Card>
  );
}
