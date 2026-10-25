"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { DELIVERY_WINDOW, cutoffLabel, longDate } from "@/lib/delivery-labels";
import { haptic } from "@/lib/haptics";
import { placeOrder, type PaymentChoice } from "./actions";
import { track } from "@/lib/analytics";

type SavedAddress = {
  id: string;
  label: string;
  line: string;
  landmark: string | null;
  isDefault: boolean;
  zone: { id: string; name: string; served: boolean; fee: number };
  dateIso: string | null;
  cutoffIso: string | null;
};
type ZoneOption = { id: string; name: string; area: string; fee: number; dateIso: string; cutoffIso: string };
type Line = { productId: string; name: string; quantity: string; total: number; emoji: string; publicId: string | null };

const LABELS = ["Home", "Work", "Family"];
const field =
  "h-12 w-full rounded-xl border border-hairline bg-surface px-3.5 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-carbon focus:shadow-[0_0_0_3px_rgb(0_0_0/0.08)]";

export function CheckoutFlow(props: {
  basketId: string;
  /** A one-time order reads as an order, not a basket. */
  oneOff?: boolean;
  initialPayment?: PaymentChoice;
  lines: Line[];
  leftOut: string[];
  subtotal: number;
  memberSaving: number;
  freePlan: boolean;
  freeThreshold: number;
  addresses: SavedAddress[];
  zones: ZoneOption[];
  contact: { name: string; phone: string; email: string };
  credit: number;
  transfer: { bankName: string; accountName: string; accountNumber: string } | null;
  /** For a first address: what the account already knows. */
  draftDefaults?: { line1: string; zoneId: string | null };
}) {
  const usable = props.addresses.filter((a) => a.zone.served);
  const [addressId, setAddressId] = useState<string | null>((usable.find((a) => a.isDefault) ?? usable[0])?.id ?? null);
  const [adding, setAdding] = useState(usable.length === 0);
  const [draft, setDraft] = useState({
    label: "Home",
    line1: props.draftDefaults?.line1 ?? "",
    estate: "",
    landmark: "",
    instructions: "",
    altPhone: "",
    zoneId: props.draftDefaults?.zoneId ?? props.zones[0]?.id ?? "",
  });
  const [contact, setContact] = useState(props.contact);
  const [editContact, setEditContact] = useState(!props.contact.name || !props.contact.phone);
  const [payment, setPayment] = useState<PaymentChoice>(props.initialPayment ?? "POD");
  const [useCredit, setUseCredit] = useState(props.credit > 0);
  const [showItems, setShowItems] = useState(props.lines.length <= 4);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Where it's going decides the date and the fee.
  const picked = adding ? null : props.addresses.find((a) => a.id === addressId) ?? null;
  const draftZone = props.zones.find((z) => z.id === draft.zoneId) ?? null;
  const when = adding ? (draftZone ? { dateIso: draftZone.dateIso, cutoffIso: draftZone.cutoffIso } : null) : picked?.dateIso && picked.cutoffIso ? { dateIso: picked.dateIso, cutoffIso: picked.cutoffIso } : null;
  const areaFee = adding ? draftZone?.fee : picked?.zone.fee;
  const quote = quoteDelivery(props.subtotal, props.freePlan, areaFee ?? 0, props.freeThreshold);
  const creditUsed = useCredit ? Math.min(props.credit, props.subtotal + quote.fee) : 0;
  const total = props.subtotal + quote.fee - creditUsed;

  const submit = () => {
    haptic("light");
    setError(null);
    track("checkout_submitted", { flow: "checkout", payment, newAddress: adding, useCredit });
    start(async () => {
      const r = await placeOrder({
        basketId: props.basketId,
        addressId: adding ? null : addressId,
        newAddress: adding ? { ...draft, isDefault: usable.length === 0 } : null,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        payment,
        useCredit,
      });
      // Success navigates to the order. Anything else comes back as a sentence.
      if (r && !r.ok) {
        haptic("error");
        track("checkout_failed", { flow: "checkout", error: r.error });
        setError(r.error);
        if (r.addressId && adding) {
          setAdding(false);
          setAddressId(r.addressId);
        }
      }
    });
  };

  return (
    <div className="mt-6 grid gap-4">
      {/* When */}
      <Section title="When">
        {when ? (
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-pop/30">
              <Icon name="calendar" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{longDate(when.dateIso)}</p>
              <p className="text-sm text-muted">
                {DELIVERY_WINDOW} · change until {cutoffLabel(when.cutoffIso)}
              </p>
            </div>
            <Link href="/basket" className="shrink-0 text-sm font-semibold underline underline-offset-2">
              Change day
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">Pick where we&apos;re delivering and we&apos;ll show the date.</p>
        )}
      </Section>

      {/* Where */}
      <Section title="Where">
        {props.addresses.length > 0 && (
          <div className="grid gap-2">
            {props.addresses.map((a) => {
              const on = !adding && a.id === addressId;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!a.zone.served}
                  onClick={() => {
                    setAdding(false);
                    setAddressId(a.id);
                  }}
                  aria-pressed={on}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left disabled:opacity-55 ${on ? "border-carbon bg-mint-pop/15" : "border-hairline bg-surface"}`}
                >
                  <span className={`mt-0.5 size-5 shrink-0 rounded-full border-2 ${on ? "border-carbon bg-carbon shadow-[inset_0_0_0_3px_var(--surface)]" : "border-hairline"}`} />
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold">{a.label}</b>
                    <span className="block text-sm">{a.line}</span>
                    <small className="block text-[13px] text-muted">
                      {a.landmark ? `Near ${a.landmark} · ` : ""}
                      {a.zone.name}
                      {!a.zone.served && " · we don't deliver here yet"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {adding ? (
          <div className={props.addresses.length ? "mt-4 border-t border-hairline pt-4" : ""}>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Call this address">
              {LABELS.map((l) => (
                <button key={l} type="button" onClick={() => setDraft({ ...draft, label: l })} aria-pressed={draft.label === l} className={`rounded-full border px-3 py-1 text-sm ${draft.label === l ? "border-carbon bg-carbon text-paper-white" : "border-hairline"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="House number and street">
                <input className={field} autoComplete="address-line1" value={draft.line1} onChange={(e) => setDraft({ ...draft, line1: e.target.value })} placeholder="12 Admiralty Way" />
              </Field>
              <Field label="Estate or building" optional>
                <input className={field} autoComplete="address-line2" value={draft.estate} onChange={(e) => setDraft({ ...draft, estate: e.target.value })} placeholder="Lekki Gardens, Block C, Flat 4" />
              </Field>
              <Field label="Nearest bus stop or landmark" optional>
                <input className={field} value={draft.landmark} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })} placeholder="Opposite the Total filling station" />
              </Field>
              <Field label="Area">
                <select className={field} value={draft.zoneId} onChange={(e) => setDraft({ ...draft, zoneId: e.target.value })}>
                  {props.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.area})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Gate or delivery notes" optional>
                <textarea className={`${field} h-auto py-3`} rows={2} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder="Tell the gate man it's for flat 4. Call on arrival." />
              </Field>
              <Field label="Another number we can call" optional>
                <input className={field} type="tel" inputMode="tel" autoComplete="tel" value={draft.altPhone} onChange={(e) => setDraft({ ...draft, altPhone: e.target.value })} placeholder="0803 123 4567" />
              </Field>
            </div>
            {usable.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className="mt-3 text-sm font-semibold underline underline-offset-2">
                Use a saved address
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
            <Icon name="plus" size={14} weight="bold" />
            Add a new address
          </button>
        )}
      </Section>

      {/* Contact */}
      <Section title="Who to ask for">
        {editContact ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={field} autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={field} type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="0803 123 4567" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email for your receipt" optional>
                <input className={field} type="email" inputMode="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              </Field>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">
              <b className="block font-semibold">{contact.name}</b>
              {contact.phone}
              {contact.email ? ` · ${contact.email}` : ""}
            </p>
            <button type="button" onClick={() => setEditContact(true)} className="shrink-0 text-sm font-semibold underline underline-offset-2">
              Edit
            </button>
          </div>
        )}
      </Section>

      {/* Payment */}
      <Section title="How you'll pay">
        <div className="grid gap-2">
          <PayOption on={payment === "POD"} onClick={() => setPayment("POD")} title="Pay when it arrives" sub="Transfer or card to the rider at your door. Nothing to pay now." />
          {props.transfer && (
            <PayOption on={payment === "TRANSFER"} onClick={() => setPayment("TRANSFER")} title="Pay now by transfer" sub="Into our bank account, before it's packed. The details come next." />
          )}
          <PayOption on={false} disabled title="Card" sub="Coming soon" />
        </div>
        {payment === "TRANSFER" && props.transfer && (
          <p className="mt-3 rounded-xl bg-soft-mist p-3 text-sm">
            {props.transfer.bankName} · {props.transfer.accountNumber} · {props.transfer.accountName}. Use your order number as the reference; you&apos;ll see it on the next page.
          </p>
        )}
      </Section>

      {/* Items and total */}
      <Section title={`${props.lines.length} item${props.lines.length === 1 ? "" : "s"}`}>
        {showItems ? (
          <ul className="divide-y divide-hairline">
            {props.lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 py-2 text-sm">
                <ProductImage publicId={l.publicId} alt={l.name} emoji={l.emoji} className="size-10 shrink-0" rounded="rounded-lg" emojiClassName="text-lg" sizes="40px" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{l.name}</span>
                  <small className="text-muted">{l.quantity}</small>
                </span>
                <span className="shrink-0">{formatNaira(l.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => setShowItems(true)} className="text-sm font-semibold underline underline-offset-2">
            Show items
          </button>
        )}
        {props.leftOut.length > 0 && (
          <p className="mt-3 rounded-xl bg-soft-mist p-3 text-xs">
            <b className="font-semibold">Sold out this week, left out:</b> {props.leftOut.join(", ")}.
          </p>
        )}

        <dl className="mt-4 grid gap-1.5 border-t border-hairline pt-4 text-sm">
          <Row label="Items" value={formatNaira(props.subtotal)} />
          <Row label="Delivery" value={areaFee === undefined ? "—" : quote.fee ? formatNaira(quote.fee) : "Free"} />
          {props.credit > 0 && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="size-4 accent-carbon" />
                Use {formatNaira(Math.min(props.credit, props.subtotal + quote.fee))} account credit
              </label>
              {creditUsed > 0 && <dd className="font-medium">−{formatNaira(creditUsed)}</dd>}
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t border-hairline pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className="text-xl font-semibold">{formatNaira(total)}</dd>
          </div>
          {props.memberSaving > 0 && <p className="text-xs text-muted">Membership saves you {formatNaira(props.memberSaving)} on this order.</p>}
        </dl>
      </Section>

      {error && (
        <p role="alert" className="rounded-xl border border-hairline bg-ember/12 p-3 text-sm">
          {error}
        </p>
      )}

      <Button size="lg" className="w-full" loading={pending} disabled={!when} onClick={submit}>
        {props.oneOff ? "Confirm order" : "Confirm basket"} · {formatNaira(total)}
      </Button>
      <p className="-mt-1 text-center text-xs text-muted">
        {payment === "POD" ? "You pay when it arrives." : "Transfer once you see your order number."} You can change or cancel it until {when ? cutoffLabel(when.cutoffIso) : "the day before"}.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline sm:p-5">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">{title}</h2>
      {children}
    </section>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function PayOption({ on, onClick, title, sub, disabled }: { on: boolean; onClick?: () => void; title: string; sub: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!on) haptic("selection");
        onClick?.();
      }}
      disabled={disabled}
      aria-pressed={on}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.99] disabled:opacity-50 ${on ? "border-carbon bg-mint-pop/15" : "border-hairline bg-surface"}`}
    >
      <span className={`mt-0.5 size-5 shrink-0 rounded-full border-2 ${on ? "border-carbon bg-carbon shadow-[inset_0_0_0_3px_var(--surface)]" : "border-hairline"}`} />
      <span>
        <b className="block font-semibold">{title}</b>
        <small className="block text-[13px] text-muted">{sub}</small>
      </span>
    </button>
  );
}
