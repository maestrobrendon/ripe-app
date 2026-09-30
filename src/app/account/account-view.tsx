"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatNaira, GOAL_LABEL, PRODUCE_PREFERENCE_LABEL, PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";
import { GOALS } from "@/lib/assistant";
import { press, spring } from "@/lib/motion/tokens";
import { cancelSubscription } from "@/app/subscribe/actions";
import {
  saveAddress,
  saveContact,
  savePreferences,
  addTestCard,
  removeCard,
  signOut,
  type SaveResult,
} from "./actions";

export type OrderRow = {
  id: string;
  kind: "basket" | "cart";
  name: string;
  when: string;
  total: number;
  status: string;
  live: boolean;
};

type Sheet = "address" | "payment" | "prefs" | "profile" | "orders" | "member" | "signout" | null;

type Props = {
  name: string;
  email: string;
  phone: string;
  address: string;
  zoneSlug: string;
  zoneName: string;
  zones: { slug: string; name: string }[];
  card: { brand: string; last4: string; expiry: string } | null;
  adults: number;
  kids: number;
  goal: string;
  likes: string[];
  membership: { tierName: string; monthlyFee: number; renews: string | null } | null;
  cheapestPlan: number | null;
  orders: OrderRow[];
  whatsappHref: string;
};

const FIELD =
  "h-13 w-full rounded-input border border-border bg-surface px-3.5 text-base outline-none focus:border-carbon";
const LABEL = "mb-1.5 mt-3.5 block text-sm font-semibold";
const PRIMARY = "tap-target mt-5 h-13 w-full rounded-full bg-carbon text-base font-semibold text-white disabled:opacity-60";
const SOFT = "tap-target mt-2 h-13 w-full rounded-full bg-soft-mist text-base font-semibold disabled:opacity-60";

export function AccountView(props: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  /** Close, refresh the server data, confirm. */
  const saved = (message: string) => {
    setSheet(null);
    router.refresh();
    flash(message);
  };

  const hasAddress = Boolean(props.address && props.zoneSlug);
  const missing: [Exclude<Sheet, null>, string][] = [];
  if (!hasAddress) missing.push(["address", "Add your delivery address"]);
  if (!props.card) missing.push(["payment", "Add a payment method"]);
  if (!props.goal) missing.push(["prefs", "Tell us what you like to eat"]);
  const doneCount = 3 - missing.length;

  const people = props.adults + props.kids;
  const live = props.orders.find((o) => o.live);
  const ordersSub = live
    ? `${live.name}: ${live.status.toLowerCase()}`
    : props.orders.length
      ? `${props.orders.length} past ${props.orders.length === 1 ? "order" : "orders"}`
      : "None yet";

  const signOutButton = (
    <button
      onClick={() => setSheet("signout")}
      className="mx-auto mt-6.5 block h-12 rounded-full border border-border px-6 font-semibold text-ember"
    >
      Sign out
    </button>
  );

  return (
    <div className="lg:pl-60 xl:pl-0">
      <div className="mx-auto max-w-5xl pb-6 lg:grid lg:grid-cols-[360px_1fr] lg:gap-10 lg:px-6 lg:pt-8">
        {/* Left on desktop: who you are, what's left to set up, membership */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3.5 px-5 pb-1 pt-3 lg:px-0 lg:pt-0">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-carbon text-[22px] font-semibold text-white" aria-hidden>
              {props.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{props.name}</h1>
              <small className="block truncate text-sm text-muted">{props.email || props.phone}</small>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {missing.length > 0 && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.smooth}
                className="mx-5 mt-4.5 overflow-hidden rounded-[18px] bg-sunburst/20 lg:mx-0"
              >
                <div className="p-4">
                  <h2 className="text-base font-semibold">Finish setting up</h2>
                  <p className="mt-0.5 text-sm text-muted">{doneCount} of 3 done. This helps your first delivery go smoothly.</p>
                  <div className="mb-1 mt-3 h-1.5 overflow-hidden rounded-full bg-sunburst/35">
                    <motion.i
                      className="block h-full rounded-full bg-sunburst"
                      initial={false}
                      animate={{ width: `${(doneCount / 3) * 100}%` }}
                      transition={spring.smooth}
                    />
                  </div>
                  {missing.map(([key, text]) => (
                    <button
                      key={key}
                      onClick={() => setSheet(key)}
                      className="flex w-full items-center gap-2.5 py-2.5 text-left text-[15px] font-semibold"
                    >
                      <span className="h-5.5 w-5.5 flex-none rounded-full border-[1.5px] border-carbon" />
                      {text}
                      <Icon name="caretRight" size={16} className="ml-auto text-muted" />
                    </button>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setSheet("member")}
            whileTap={{ scale: press.scaleLarge }}
            className={`mx-5 mt-3.5 flex w-[calc(100%-2.5rem)] items-center gap-3.5 rounded-[18px] p-4 text-left text-carbon lg:mx-0 lg:w-full ${
              props.membership ? "bg-mint-pop/25" : "bg-lavender"
            }`}
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-white">
              <Icon name="star" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-base font-semibold">{props.membership ? "You are a member" : "Become a member"}</b>
              <small className="text-sm text-carbon/75">
                {props.membership
                  ? props.membership.renews
                    ? `${props.membership.tierName}, renews ${props.membership.renews}`
                    : `${props.membership.tierName}, ${formatNaira(props.membership.monthlyFee)} a month`
                  : "Weekly baskets and lower prices"}
              </small>
            </span>
            <Icon name="caretRight" size={18} className="flex-none" />
          </motion.button>

          <div className="hidden lg:block">
            {signOutButton}
            <p className="mt-3 text-center text-xs text-muted">Basket, version 1.0</p>
          </div>
        </div>

        {/* Right on desktop: orders, details, help */}
        <div>
          <Group title="Orders">
            <Row icon="box" title="Your orders" sub={ordersSub} onClick={() => setSheet("orders")} />
          </Group>

          <Group title="Your details">
            <Row
              icon="pin"
              title="Delivery address"
              sub={hasAddress ? `${props.address}, ${props.zoneName}` : "Not set"}
              warn={!hasAddress}
              onClick={() => setSheet("address")}
            />
            <Row
              icon="payment"
              title="Payment method"
              sub={props.card ? `${props.card.brand} ending ${props.card.last4}` : "Not set"}
              warn={!props.card}
              onClick={() => setSheet("payment")}
            />
            <Row
              icon="leaf"
              title="Food preferences"
              sub={
                props.goal
                  ? `${people} ${people === 1 ? "person" : "people"}, ${(GOAL_LABEL[props.goal] ?? props.goal).toLowerCase()}`
                  : "Not set"
              }
              warn={!props.goal}
              onClick={() => setSheet("prefs")}
            />
            <Row
              icon="account"
              title="Name and contact"
              sub={props.phone ? `${props.name}, ${props.phone}` : props.name}
              onClick={() => setSheet("profile")}
            />
          </Group>

          <Group title="Help">
            <Row icon="whatsapp" title="Chat with us on WhatsApp" sub="Usually replies in minutes" href={props.whatsappHref} external />
            <Row icon="help" title="Questions and answers" href="/faq" />
            <Row icon="map" title="Where we deliver" href="/delivery-areas" />
            <Row icon="leaf" title="About Basket" href="/about" />
            <Row icon="doc" title="Terms and privacy" href="/terms" />
          </Group>

          <div className="lg:hidden">
            {signOutButton}
            <p className="mt-3 text-center text-xs text-muted">Basket, version 1.0</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.snappy}
            className="fixed inset-x-5 bottom-[calc(var(--dock-clearance)+0.5rem)] z-(--z-overlay) rounded-[14px] bg-carbon px-4 py-3.5 text-[15px] text-white lg:inset-x-auto lg:bottom-8 lg:left-1/2 lg:-translate-x-1/2"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet desktopDialog open={sheet === "address"} onClose={() => setSheet(null)} title="Delivery address">
        <AddressForm {...props} onSaved={() => saved("Address saved")} onError={flash} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "payment"} onClose={() => setSheet(null)} title="Payment method">
        <PaymentForm card={props.card} onSaved={saved} onError={flash} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "prefs"} onClose={() => setSheet(null)} title="Food preferences">
        <PrefsForm {...props} onSaved={() => saved("Preferences saved")} onError={flash} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "profile"} onClose={() => setSheet(null)} title="Name and contact">
        <ContactForm {...props} onSaved={() => saved("Saved")} onError={flash} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "orders"} onClose={() => setSheet(null)} title="Your orders">
        <OrdersList orders={props.orders} />
      </BottomSheet>
      <BottomSheet
        desktopDialog
        open={sheet === "member"}
        onClose={() => setSheet(null)}
        title={props.membership ? "Your membership" : "Become a member"}
      >
        <MembershipSheet
          membership={props.membership}
          cheapestPlan={props.cheapestPlan}
          onCancelled={() => saved("Membership cancelled.")}
        />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "signout"} onClose={() => setSheet(null)} title="Sign out?">
        <p className="mb-3 text-[15px] leading-snug text-muted">Your baskets, cart and timetable are saved to your account.</p>
        <form action={signOut}>
          <button className="tap-target mt-5 h-13 w-full rounded-full bg-ember text-base font-semibold text-white">Sign out</button>
        </form>
        <button onClick={() => setSheet(null)} className={SOFT}>
          Stay signed in
        </button>
      </BottomSheet>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 pt-6.5 lg:px-0 lg:first:pt-0">
      <h3 className="mb-1.5 ml-1 text-[13px] font-semibold text-muted">{title}</h3>
      <div className="overflow-hidden rounded-[18px] border-[1.5px] border-border [&>*+*]:border-t [&>*+*]:border-border">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  sub,
  warn,
  onClick,
  href,
  external,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  warn?: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-soft-mist">
        <Icon name={icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{title}</b>
        {sub && (
          <small className={`flex items-center gap-1.5 truncate text-[13px] ${warn ? "font-semibold text-carbon" : "text-muted"}`}>
            {warn && <span className="h-2 w-2 flex-none rounded-full bg-sunburst" aria-hidden />}
            <span className="truncate">{sub}</span>
          </small>
        )}
      </span>
      <Icon name="caretRight" size={16} className="flex-none text-muted" />
    </>
  );
  const cls = "flex min-h-15.5 w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors active:bg-soft-mist lg:hover:bg-soft-mist";
  if (href && external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function useSave(onSaved: () => void, onError: (m: string) => void) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<SaveResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) onSaved();
      else onError(r.error);
    });
  return { pending, run };
}

function AddressForm({
  address,
  zoneSlug,
  zones,
  onSaved,
  onError,
}: Props & { onSaved: () => void; onError: (m: string) => void }) {
  const [street, setStreet] = useState(address);
  const [zone, setZone] = useState(zoneSlug);
  const { pending, run } = useSave(onSaved, onError);
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">Where should we bring your produce?</p>
      <label className={LABEL} htmlFor="ad">
        Street address
      </label>
      <textarea
        id="ad"
        value={street}
        onChange={(e) => setStreet(e.target.value)}
        placeholder="House number, street, and a landmark"
        className={`${FIELD} h-22 resize-none py-3`}
      />
      <label className={LABEL} htmlFor="zn">
        Area
      </label>
      <select id="zn" value={zone} onChange={(e) => setZone(e.target.value)} className={FIELD}>
        <option value="">Choose your area</option>
        {zones.map((z) => (
          <option key={z.slug} value={z.slug}>
            {z.name}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        onClick={() => {
          if (!street.trim() || !zone) return onError("Add your street and area");
          run(() => saveAddress({ address: street, zoneSlug: zone }));
        }}
        className={PRIMARY}
      >
        Save address
      </button>
    </>
  );
}

function PaymentForm({
  card,
  onSaved,
  onError,
}: {
  card: Props["card"];
  onSaved: (message: string) => void;
  onError: (m: string) => void;
}) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<SaveResult>, message: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) onSaved(message);
      else onError(r.error);
    });

  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">Used for your cart orders and weekly baskets.</p>
      {card ? (
        <>
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-border p-4">
            <span className="flex h-7.5 w-11 items-center justify-center rounded-md bg-carbon text-[11px] font-bold text-white">
              {card.brand}
            </span>
            <span>
              <b className="font-semibold">Ending {card.last4}</b>
              <small className="block text-[13px] text-muted">Expires {card.expiry}</small>
            </span>
          </div>
          <button disabled={pending} onClick={() => run(removeCard, "Card removed")} className={`${SOFT} text-ember`}>
            Remove card
          </button>
        </>
      ) : (
        <>
          <label className={LABEL} htmlFor="cn">
            Card number
          </label>
          <input
            id="cn"
            inputMode="numeric"
            autoComplete="cc-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="4084 0840 8408 4081"
            className={FIELD}
          />
          <label className={LABEL} htmlFor="ce">
            Expiry
          </label>
          <input
            id="ce"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="MM/YY"
            className={FIELD}
          />
          <button disabled={pending} onClick={() => run(() => addTestCard({ number, expiry }), "Card added")} className={PRIMARY}>
            Add a card
          </button>
          <p className="mt-2.5 text-center text-[13px] text-muted">Payments are in test mode. No money moves yet.</p>
        </>
      )}
    </>
  );
}

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex h-13 items-center justify-between rounded-input border-[1.5px] border-border pl-3.5 pr-1.5">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-mist"
        >
          <Icon name="minus" size={14} />
        </button>
        <b className="min-w-4.5 text-center">{value}</b>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`More ${label.toLowerCase()}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-mist"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: press.scale }}
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 rounded-full px-3.5 text-sm ${on ? "bg-carbon font-semibold text-white" : "bg-soft-mist"}`}
    >
      {children}
    </motion.button>
  );
}

function PrefsForm({
  adults,
  kids,
  goal,
  likes,
  onSaved,
  onError,
}: Props & { onSaved: () => void; onError: (m: string) => void }) {
  const [a, setA] = useState(adults);
  const [k, setK] = useState(kids);
  const [g, setG] = useState(goal);
  const [l, setL] = useState<string[]>(likes);
  const { pending, run } = useSave(onSaved, onError);
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">Kachi and the planners use this to suggest the right amounts.</p>
      <span className={LABEL}>Who are you feeding?</span>
      <div className="grid grid-cols-2 gap-2.5">
        <Stepper label="Adults" value={a} onChange={setA} min={1} max={10} />
        <Stepper label="Children" value={k} onChange={setK} min={0} max={10} />
      </div>
      <span className={LABEL}>What do you want most?</span>
      <div className="flex flex-wrap gap-2">
        {GOALS.map((x) => (
          <Chip key={x.slug} on={g === x.slug} onClick={() => setG(x.slug)}>
            {GOAL_LABEL[x.slug] ?? x.label}
          </Chip>
        ))}
      </div>
      <span className={LABEL}>What do you usually buy?</span>
      <div className="flex flex-wrap gap-2">
        {PRODUCE_PREFERENCE_OPTIONS.map((x) => (
          <Chip key={x} on={l.includes(x)} onClick={() => setL((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]))}>
            {PRODUCE_PREFERENCE_LABEL[x]}
          </Chip>
        ))}
      </div>
      <button
        disabled={pending}
        onClick={() => {
          if (!g) return onError("Pick what you want most");
          run(() => savePreferences({ adults: a, kids: k, goal: g, likes: l }));
        }}
        className={PRIMARY}
      >
        Save
      </button>
    </>
  );
}

function ContactForm({ name, phone, email, onSaved, onError }: Props & { onSaved: () => void; onError: (m: string) => void }) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [e, setE] = useState(email);
  const { pending, run } = useSave(onSaved, onError);
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">So our riders can reach you.</p>
      <label className={LABEL} htmlFor="nm">
        Name
      </label>
      <input id="nm" value={n} onChange={(ev) => setN(ev.target.value)} autoComplete="name" className={FIELD} />
      <label className={LABEL} htmlFor="ph">
        Phone number
      </label>
      <input id="ph" type="tel" value={p} onChange={(ev) => setP(ev.target.value)} placeholder="0803 000 0000" autoComplete="tel" className={FIELD} />
      <label className={LABEL} htmlFor="em">
        Email
      </label>
      <input id="em" type="email" value={e} onChange={(ev) => setE(ev.target.value)} autoComplete="email" className={FIELD} />
      <button disabled={pending} onClick={() => run(() => saveContact({ name: n, phone: p, email: e }))} className={PRIMARY}>
        Save
      </button>
    </>
  );
}

function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [tab, setTab] = useState<"all" | "basket" | "cart">("all");
  const list = orders.filter((o) => tab === "all" || o.kind === tab);
  return (
    <>
      <div className="mb-1.5 mt-1 flex gap-2">
        {(
          [
            ["all", "All"],
            ["basket", "Baskets"],
            ["cart", "Cart"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`h-9 rounded-full px-3.5 text-sm ${tab === key ? "bg-carbon font-semibold text-white" : "bg-soft-mist"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        list.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="flex w-full items-center gap-3 border-b border-border py-3.5 text-left">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-soft-mist text-xl" aria-hidden>
              {o.kind === "basket" ? "🧺" : "🛒"}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-semibold">{o.name}</b>
              <small className="text-[13px] text-muted">
                {o.when}, {formatNaira(o.total)}
              </small>
            </span>
            <span className={`rounded-[10px] px-2.5 py-1 text-xs font-semibold ${o.live ? "bg-mint-pop/30 text-carbon" : "bg-soft-mist"}`}>
              {o.status}
            </span>
          </Link>
        ))
      ) : (
        <p className="px-2.5 py-7.5 text-center text-[15px] leading-normal text-muted">
          No orders yet.
          <br />
          When you check out, they show up here.
        </p>
      )}
    </>
  );
}

function MembershipSheet({
  membership,
  cheapestPlan,
  onCancelled,
}: {
  membership: Props["membership"];
  cheapestPlan: number | null;
  onCancelled: () => void;
}) {
  const [pending, start] = useTransition();
  if (membership) {
    return (
      <>
        <p className="mb-3 text-[15px] leading-snug text-muted">
          {membership.tierName}, {formatNaira(membership.monthlyFee)} a month.
          {membership.renews ? ` Renews ${membership.renews}.` : ""}
        </p>
        <Link href="/subscribe" className={`${PRIMARY} flex items-center justify-center`}>
          Change plan
        </Link>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await cancelSubscription();
              onCancelled();
            })
          }
          className={SOFT}
        >
          Cancel membership
        </button>
      </>
    );
  }
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">
        {cheapestPlan ? `From ${formatNaira(cheapestPlan)} a month. ` : ""}Stop anytime.
      </p>
      <ul className="mb-1.5">
        {[
          "Baskets that come every week, on your day",
          "As many baskets as you want",
          "Lower prices on everything",
          "Keep your food timetable every week",
        ].map((perk) => (
          <li key={perk} className="flex gap-2.5 py-2 text-base">
            <Icon name="checkPlain" size={20} weight="bold" className="flex-none text-carbon" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <Link href="/subscribe" className={`${PRIMARY} flex items-center justify-center`}>
        See plans
      </Link>
    </>
  );
}
