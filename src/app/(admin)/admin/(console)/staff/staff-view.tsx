"use client";

import { useState, useTransition } from "react";
import { ROLE_LABEL, type Role } from "@/lib/admin/permissions";
import type { ActionResult } from "@/lib/admin/guard";
import { useAdminAction } from "../step-up";
import { Alert, Badge, Button, Card, Field, Input, cx } from "../../_ui/kit";
import { changeRole, inviteStaff, setSuspended, signOutStaffEverywhere, withdrawInvite } from "./actions";

export type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  passkeys: number;
  totp: boolean;
  locked: boolean;
  sessions: number;
  isMe: boolean;
};
export type InviteRow = { id: string; email: string; name: string; role: Role; expiresAt: string };
type Perms = { invite: boolean; roles: boolean; suspend: boolean; sessions: boolean };

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "Never";

const selectClass = "h-9 rounded-lg bg-paper-white px-2 text-[13px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]";

export function StaffView({ rows, invites, assignable, perms }: { rows: StaffRow[]; invites: InviteRow[]; assignable: { value: Role; label: string }[]; perms: Perms }) {
  const run = useAdminAction();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [link, setLink] = useState<{ url: string; emailed: boolean } | null>(null);
  // Bumped after a successful invite so the form remounts closed and empty.
  const [formKey, setFormKey] = useState(0);
  const canAssign = (r: Role) => assignable.some((a) => a.value === r);

  const act = <T,>(fn: () => Promise<ActionResult<T>>, ok: string | ((data: T) => string)) =>
    start(async () => {
      setNotice(null);
      const r = await run(fn);
      if (r.ok) setNotice({ tone: "success", text: typeof ok === "function" ? ok(r.data) : ok });
      else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });

  return (
    <div className="space-y-5">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {perms.invite && assignable.length > 0 && (
        <InviteForm
          key={formKey}
          roles={assignable}
          busy={pending}
          onSubmit={(input) =>
            start(async () => {
              setNotice(null);
              setLink(null);
              const r = await run(() => inviteStaff(input));
              if (r.ok) {
                setLink({ url: r.data.link, emailed: r.data.emailed });
                setFormKey((k) => k + 1);
              }
              else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
            })
          }
        />
      )}

      {link && (
        <Alert tone="success">
          Invite created.{" "}
          {link.emailed ? "We emailed the link too. " : "Email isn't configured here, so send this link yourself over a channel you trust. "}
          It works once, for 24 hours, and won&apos;t be shown again:
          <span className="mt-2 block font-mono text-[12px] break-all select-all">{link.url}</span>
        </Alert>
      )}

      <Card title={<span className="block px-5 pt-5">Team ({rows.length})</span>} className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-y border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Person</th>
                <th className="px-3 py-2.5 font-semibold">Role</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Second factor</th>
                <th className="px-3 py-2.5 font-semibold">Last sign-in</th>
                <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((s) => {
                const manageable = !s.isMe && canAssign(s.role);
                return (
                  <tr key={s.id} className="align-middle">
                    <td className="px-5 py-3">
                      <p className="font-semibold">
                        {s.name} {s.isMe && <span className="font-normal text-carbon/45">(you)</span>}
                      </p>
                      <p className="text-carbon/55">{s.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      {perms.roles && manageable ? (
                        <select
                          aria-label={`Role for ${s.name}`}
                          className={selectClass}
                          value={s.role}
                          disabled={pending}
                          onChange={(e) => {
                            const next = e.target.value as Role;
                            if (window.confirm(`Change ${s.name} to ${ROLE_LABEL[next]}? They'll be signed out everywhere.`)) {
                              act(() => changeRole(s.id, next), `${s.name} is now ${ROLE_LABEL[next]}.`);
                            }
                          }}
                        >
                          {assignable.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        ROLE_LABEL[s.role]
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={s.status === "ACTIVE" ? "good" : s.status === "SUSPENDED" ? "bad" : "warn"}>
                          {s.status === "ACTIVE" ? "Active" : s.status === "SUSPENDED" ? "Suspended" : "Setting up"}
                        </Badge>
                        {s.locked && <Badge tone="bad">Locked</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-carbon/70">
                      {[s.passkeys > 0 && `${s.passkeys} passkey${s.passkeys > 1 ? "s" : ""}`, s.totp && "app"].filter(Boolean).join(" + ") || "None yet"}
                    </td>
                    <td className="px-3 py-3 text-carbon/70">
                      {when(s.lastLoginAt)}
                      {s.sessions > 0 && <span className="block text-[12px] text-carbon/45">{s.sessions} signed-in session{s.sessions > 1 ? "s" : ""}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {perms.sessions && (s.isMe || manageable) && s.sessions > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => act(() => signOutStaffEverywhere(s.id), (d) => `Ended ${d.count} session${d.count === 1 ? "" : "s"}.`)}
                          >
                            {s.isMe ? "Sign out other devices" : "Sign out"}
                          </Button>
                        )}
                        {perms.suspend && manageable && s.status !== "INVITED" && (
                          <Button
                            size="sm"
                            variant={s.status === "SUSPENDED" ? "secondary" : "ghost"}
                            className={cx(s.status !== "SUSPENDED" && "text-[#9a2c00]")}
                            disabled={pending}
                            onClick={() => {
                              const suspend = s.status !== "SUSPENDED";
                              if (suspend && !window.confirm(`Suspend ${s.name}? They'll be signed out and can't sign in until reactivated.`)) return;
                              act(() => setSuspended(s.id, suspend), suspend ? `${s.name} is suspended.` : `${s.name} can sign in again.`);
                            }}
                          >
                            {s.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {invites.length > 0 && (
        <Card title="Open invites">
          <ul className="divide-y divide-black/5">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <p className="font-semibold">
                    {i.name} <span className="font-normal text-carbon/55">· {i.email}</span>
                  </p>
                  <p className="text-carbon/55">
                    {ROLE_LABEL[i.role]} · expires {when(i.expiresAt)}
                  </p>
                </div>
                {perms.invite && canAssign(i.role) && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => withdrawInvite(i.id), `Withdrew the invite for ${i.email}.`)}>
                    Withdraw
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function InviteForm({ roles, busy, onSubmit }: { roles: { value: Role; label: string }[]; busy: boolean; onSubmit: (input: { email: string; name: string; role: string }) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Invite someone</Button>
      </div>
    );
  }
  return (
    <Card title="Invite someone" actions={<Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>}>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_220px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSubmit({ email: String(f.get("email") ?? ""), name: String(f.get("name") ?? ""), role: String(f.get("role") ?? "") });
        }}
      >
        <Field label="Name" htmlFor="invite-name">
          <Input id="invite-name" name="name" required maxLength={80} autoComplete="off" />
        </Field>
        <Field label="Work email" htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required maxLength={254} autoComplete="off" />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <select id="invite-role" name="role" required className={cx(selectClass, "h-11 w-full rounded-xl")} defaultValue="">
            <option value="" disabled>
              Choose a role
            </option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={busy}>
          Send invite
        </Button>
      </form>
      <p className="mt-3 text-[12px] text-carbon/55">
        They&apos;ll set a password and add a passkey or authenticator app before they can see anything. Give people the smallest role that covers their work.
      </p>
    </Card>
  );
}
