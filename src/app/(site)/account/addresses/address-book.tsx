"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { makeDefault, removeAddress, saveMyAddress, type AddressResult } from "./actions";
import { PinSheet } from "./pin-sheet";

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
  pin: { lat: number; lng: number } | null;
  around: { lat: number; lng: number };
  /** The delivery fee here, when fees follow distance. */
  fee: number | null;
};
type Zone = { id: string; name: string; area: string; isServed: boolean };
type Draft = Omit<Address, "id" | "zoneName" | "served" | "isDefault" | "line" | "pin" | "around" | "fee"> & { id: string | null; isDefault: boolean };

const LABELS = ["Home", "Work", "Family"];
const field =
  "h-12 w-full rounded-xl border border-hairline bg-surface px-3.5 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-carbon focus:shadow-[0_0_0_3px_rgb(0_0_0/0.08)]";

export function AddressBook({ addresses, zones, next }: { addresses: Address[]; zones: Zone[]; next: string | null }) {
  const router = useRouter();
  const cart = useCart();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [pinning, setPinning] = useState<Address | null>(null);
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
      <div className="mt-6 grid gap-3">
        {addresses.map((a) => (
          <article key={a.id} className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline">
            <div className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sky-wash">
                <Icon name={a.label === "Work" ? "shop" : "home"} size={18} weight="bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
                  {a.label}
                    {a.isDefault && <span className="rounded-full bg-mint-pop/40 px-2 py-0.5 text-[11px] font-semibold">Default</span>}
                  {!a.served && <span className="rounded-full bg-soft-mist px-2 py-0.5 text-[11px] text-muted">We don&apos;t deliver here yet</span>}
                </p>
                <p className="mt-0.5 text-[15px]">{a.line}</p>
                <p className="text-[13px] text-muted">
                  {a.landmark ? `Near ${a.landmark} · ` : ""}
                  {a.zoneName}
                  {a.altPhone ? ` · also ${a.altPhone}` : ""}
                </p>
                {a.instructions && <p className="mt-1 text-[13px] text-muted">{a.instructions}</p>}
                {a.served && (
                  <p className={`mt-1.5 flex items-center gap-1 text-[13px] ${a.pin ? "text-[#0b5a35]" : "text-muted"}`}>
                    <Icon name={a.pin ? "check" : "pin"} size={13} weight="bold" />
                    {a.pin ? "On the map" : "Not on the map yet"}
                    {a.fee != null && <span className="text-muted"> · delivery {a.pin ? "" : "about "}₦{a.fee.toLocaleString("en-NG")}</span>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex border-t border-hairline text-[15px] font-semibold [&>*+*]:border-l [&>*+*]:border-hairline">
              <button type="button" onClick={() => setPinning(a)} className="flex h-12 flex-1 items-center justify-center gap-1.5 transition-colors hover:bg-black/[0.025] active:bg-black/[0.05]">
                <Icon name="pin" size={15} weight="bold" />
                {a.pin ? "Move pin" : "Pin it"}
              </button>
              <button type="button" onClick={() => setDraft({ id: a.id, label: a.label, line1: a.line1, estate: a.estate, landmark: a.landmark, instructions: a.instructions, altPhone: a.altPhone, zoneId: a.zoneId, isDefault: a.isDefault })} className="h-12 flex-1 transition-colors hover:bg-black/[0.025] active:bg-black/[0.05]">
                Edit
              </button>
              {!a.isDefault && (
                <button type="button" disabled={pending} onClick={() => run(() => makeDefault(a.id), `${a.label} is now your default`)} className="h-12 flex-1 transition-colors hover:bg-black/[0.025] active:bg-black/[0.05]">
                  Make default
                </button>
              )}
              <button type="button" onClick={() => setRemoving(a)} className="h-12 flex-1 text-[#c2410c] transition-colors hover:bg-black/[0.025] active:bg-black/[0.05]">
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDraft(blank())}
        className="mt-3 flex h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left text-[16px] font-semibold shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline transition-colors hover:bg-black/[0.015] active:bg-black/[0.04]"
      >
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-carbon text-paper-white">
          <Icon name="plus" size={16} weight="bold" />
        </span>
        Add an address
      </button>

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
                <button key={l} type="button" onClick={() => setDraft({ ...draft, label: l })} aria-pressed={draft.label === l} className={`h-9 rounded-full px-4 text-[14px] transition-colors ${draft.label === l ? "bg-carbon font-semibold text-paper-white" : "bg-soft-mist hover:bg-black/[0.1]"}`}>
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

      <PinSheet address={pinning} onClose={() => setPinning(null)} />

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
