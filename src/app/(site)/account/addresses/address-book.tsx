"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { makeDefault, removeAddress, saveMyAddress, type AddressResult } from "./actions";

type Address = {
  id: string;
  label: string;
  line1: string;
  estate: string;
  landmark: string;
  instructions: string;
  altPhone: string;
  zoneId: string;
  zoneName: string;
  served: boolean;
  isDefault: boolean;
  line: string;
};
type Zone = { id: string; name: string; area: string; isServed: boolean };
type Draft = Omit<Address, "id" | "zoneName" | "served" | "isDefault" | "line"> & { id: string | null; isDefault: boolean };

const LABELS = ["Home", "Work", "Family"];
const field = "h-12 w-full rounded-control border border-border bg-surface px-4 text-base outline-none focus:border-carbon";

export function AddressBook({ addresses, zones, next }: { addresses: Address[]; zones: Zone[]; next: string | null }) {
  const router = useRouter();
  const cart = useCart();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blank = (): Draft => ({ id: null, label: "Home", line1: "", estate: "", landmark: "", instructions: "", altPhone: "", zoneId: zones.find((z) => z.isServed)?.id ?? zones[0]?.id ?? "", isDefault: addresses.length === 0 });

  const run = (fn: () => Promise<AddressResult>, message: string, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        cart.announce(r.error, "error");
        return;
      }
      setDraft(null);
      setRemoving(null);
      cart.announce(message);
      if (after) after();
      else router.refresh();
    });

  const zone = draft ? zones.find((z) => z.id === draft.zoneId) : null;

  return (
    <>
      <div className="mt-5 grid gap-3">
        {addresses.map((a) => (
          <article key={a.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
                <Icon name={a.label === "Work" ? "shop" : "home"} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {a.label}
                  {a.isDefault && <span className="rounded-full bg-mint-pop/40 px-2 py-0.5 text-[11px]">Default</span>}
                  {!a.served && <span className="rounded-full bg-soft-mist px-2 py-0.5 text-[11px] text-muted">We don&apos;t deliver here yet</span>}
                </p>
                <p className="text-sm">{a.line}</p>
                <p className="text-[13px] text-muted">
                  {a.landmark ? `Near ${a.landmark} · ` : ""}
                  {a.zoneName}
                  {a.altPhone ? ` · also ${a.altPhone}` : ""}
                </p>
                {a.instructions && <p className="mt-1 text-[13px] text-muted">{a.instructions}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-sm">
              <button type="button" onClick={() => setDraft({ ...a, id: a.id })} className="rounded-full border border-border px-3 py-1.5 font-semibold">
                Edit
              </button>
              {!a.isDefault && (
                <button type="button" disabled={pending} onClick={() => run(() => makeDefault(a.id), `${a.label} is now your default`)} className="rounded-full border border-border px-3 py-1.5 font-semibold">
                  Make default
                </button>
              )}
              <button type="button" onClick={() => setRemoving(a)} className="ml-auto rounded-full px-3 py-1.5 font-semibold text-muted">
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <Button size="lg" variant={addresses.length ? "secondary" : "primary"} className="mt-4 w-full" onClick={() => setDraft(blank())}>
        Add an address
      </Button>

      <BottomSheet open={Boolean(draft)} onClose={() => setDraft(null)} title={draft?.id ? "Edit address" : "New address"} desktopDialog>
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveMyAddress(draft), "Address saved", next ? () => router.push(next) : undefined);
            }}
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Call this address">
              {LABELS.map((l) => (
                <button key={l} type="button" onClick={() => setDraft({ ...draft, label: l })} aria-pressed={draft.label === l} className={`rounded-full border px-3 py-1 text-sm ${draft.label === l ? "border-carbon bg-carbon text-paper-white" : "border-border"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="House number and street">
                <input className={field} autoComplete="address-line1" value={draft.line1} onChange={(e) => setDraft({ ...draft, line1: e.target.value })} placeholder="12 Admiralty Way" required />
              </Field>
              <Field label="Estate or building" optional>
                <input className={field} autoComplete="address-line2" value={draft.estate} onChange={(e) => setDraft({ ...draft, estate: e.target.value })} placeholder="Lekki Gardens, Block C, Flat 4" />
              </Field>
              <Field label="Nearest bus stop or landmark" optional>
                <input className={field} value={draft.landmark} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })} placeholder="Opposite the Total filling station" />
              </Field>
              <Field label="Area">
                <select className={field} value={draft.zoneId} onChange={(e) => setDraft({ ...draft, zoneId: e.target.value })}>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.area}){z.isServed ? "" : " · not yet"}
                    </option>
                  ))}
                </select>
              </Field>
              {zone && !zone.isServed && <p className="-mt-1 text-xs text-muted">We don&apos;t deliver to {zone.name} yet. Save it anyway and we&apos;ll tell you when we do.</p>}
              <Field label="Gate or delivery notes" optional>
                <textarea className={`${field} h-auto py-3`} rows={2} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder="Tell the gate man it's for flat 4. Call on arrival." />
              </Field>
              <Field label="Another number we can call" optional>
                <input className={field} type="tel" inputMode="tel" autoComplete="tel" value={draft.altPhone} onChange={(e) => setDraft({ ...draft, altPhone: e.target.value })} placeholder="0803 123 4567" />
              </Field>
              {addresses.length > 0 && !addresses.find((a) => a.id === draft.id)?.isDefault && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-carbon" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
                  Make this my default address
                </label>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-ember/12 p-3 text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
              Save address
            </Button>
          </form>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove this address?">
        {removing && (
          <>
            <p className="text-sm text-muted">
              {removing.label}: {removing.line}. Orders already placed still go there.
              {removing.isDefault && addresses.length > 1 ? " Your most recent other address becomes the default." : ""}
            </p>
            <div className="mt-5 grid gap-2">
              <Button size="lg" variant="danger" loading={pending} onClick={() => run(() => removeAddress(removing.id), "Address removed")}>
                Remove it
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setRemoving(null)}>
                Keep it
              </Button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </span>
      {children}
    </label>
  );
}
