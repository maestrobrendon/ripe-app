"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { formatNaira, GOAL_LABEL, PRODUCE_PREFERENCE_LABEL, PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";
import { MENU_GOALS } from "@/lib/menu-types";
import { press } from "@/lib/motion/tokens";
import { cancelSubscription, withdrawPlanRequest } from "@/app/(site)/subscribe/actions";
import {
  saveContact,
  savePreferences,
  setNotifyChannel,
  signOut,
  signOutEverywhere,
  setKachiReviewConsent,
  requestDeletion,
  cancelDeletion,
  type SaveResult,
} from "./actions";

type Membership =
  | { state: "member"; tierName: string; monthlyFee: number; renews: string | null }
  | { state: "pending"; tierName: string; monthlyFee: number; renews: null }
  | { state: "declined"; tierName: string; monthlyFee: number; renews: null; note: string | null };

type Props = {
  name: string;
  email: string;
  phone: string;
  hasPassword: boolean;
  address: { label: string; line: string; zone: string; count: number } | null;
  adults: number;
  kids: number;
  goal: string;
  likes: string[];
  dietaryNotes: string;
  membership: Membership | null;
  orders: { count: number; live: string | null };
  notify: { whatsapp: boolean; email: boolean };
  invite: { code: string | null; reward: number; invited: number; rewarded: number; credit: number };
  kachiReview: boolean;
  deletionRequested: string | null;
  help: { href: string; verb: string };
};

type Sheet = "prefs" | "profile" | "member" | "invite" | "delete" | "signout" | null;

const FIELD = "h-13 w-full rounded-input border border-border bg-surface px-3.5 text-base outline-none focus:border-carbon";
const LABEL = "mb-1.5 mt-3.5 block text-sm font-semibold";
const PRIMARY = "tap-target mt-5 h-13 w-full rounded-full bg-carbon text-base font-semibold text-white disabled:opacity-60";
const SOFT = "tap-target mt-2 h-13 w-full rounded-full bg-soft-mist text-base font-semibold disabled:opacity-60";

/**
 * Me: who you are, your membership, invites and credit, then everything you
 * can set, grouped the way people look for it. Saving shows a toast above
 * any open sheet.
 */
export function AccountView(props: Props) {
  const router = useRouter();
  const cart = useCart();
  const [sheet, setSheet] = useState<Sheet>(null);

  const saved = (message: string) => {
    setSheet(null);
    router.refresh();
    cart.announce(message);
  };
  const failed = (message: string) => cart.announce(message, "error");

  const people = props.adults + props.kids;
  const nudges: { icon: IconName; text: string; href?: string; sheet?: Sheet }[] = [];
  if (!props.address) nudges.push({ icon: "pin", text: "Add your delivery address", href: "/account/addresses?next=/account" });
  if (!props.phone) nudges.push({ icon: "phone", text: "Add a phone number the rider can call", sheet: "profile" });

  const m = props.membership;
  const memberSub =
    m?.state === "member"
      ? `${m.tierName} · renews ${m.renews ?? "monthly"}`
      : m?.state === "pending"
        ? `Waiting for payment: ${m.tierName}`
        : m?.state === "declined"
          ? `Your ${m.tierName} request wasn't approved`
          : "Lower prices on everything";

  const signOutButton = (
    <button onClick={() => setSheet("signout")} className="mx-auto mt-6.5 block h-12 rounded-full border border-border px-6 font-semibold">
      Sign out
    </button>
  );

  return (
    <div>
      <div className="mx-auto max-w-5xl pb-6 lg:grid lg:grid-cols-[360px_1fr] lg:gap-10 lg:px-6 lg:pt-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3.5 px-5 pb-1 pt-3 lg:px-0 lg:pt-0">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-carbon text-[22px] font-semibold text-white" aria-hidden>
              {props.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{props.name || "Your account"}</h1>
              <small className="block truncate text-sm text-muted">{[props.phone, props.email].filter(Boolean).join(" · ")}</small>
            </div>
          </div>

          {nudges.length > 0 && (
            <section className="mx-5 mt-4 rounded-tile bg-sunburst/20 p-2 lg:mx-0">
              {nudges.map((n) =>
                n.href ? (
                  <Link key={n.text} href={n.href} className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 text-[15px] font-semibold">
                    <Icon name={n.icon} size={18} />
                    {n.text}
                    <Icon name="caretRight" size={16} className="ml-auto text-muted" />
                  </Link>
                ) : (
                  <button key={n.text} onClick={() => setSheet(n.sheet ?? null)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-[15px] font-semibold">
                    <Icon name={n.icon} size={18} />
                    {n.text}
                    <Icon name="caretRight" size={16} className="ml-auto text-muted" />
                  </button>
                ),
              )}
            </section>
          )}

          <motion.button
            onClick={() => setSheet("member")}
            whileTap={{ scale: press.scaleLarge }}
            className={`mx-5 mt-3.5 flex w-[calc(100%-2.5rem)] items-center gap-3.5 rounded-tile p-4 text-left text-carbon lg:mx-0 lg:w-full ${m?.state === "member" ? "bg-mint-pop/25" : m?.state === "pending" ? "bg-sunburst/25" : "bg-lavender"}`}
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-white">
              <Icon name="star" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-base font-semibold">{m?.state === "member" ? "You're a member" : m?.state === "pending" ? "Membership on its way" : "Become a member"}</b>
              <small className="text-sm text-carbon/75">{memberSub}</small>
            </span>
            <Icon name="caretRight" size={18} className="flex-none" />
          </motion.button>

          <motion.button
            onClick={() => setSheet("invite")}
            whileTap={{ scale: press.scaleLarge }}
            className="mx-5 mt-2.5 flex w-[calc(100%-2.5rem)] items-center gap-3.5 rounded-tile border-[1.5px] border-border p-4 text-left lg:mx-0 lg:w-full"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-soft-mist">
              <Icon name="gift" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-base font-semibold">Invite friends, get {formatNaira(props.invite.reward)}</b>
              <small className="text-sm text-muted">{props.invite.credit > 0 ? `${formatNaira(props.invite.credit)} credit to spend` : "Each, after their first delivery"}</small>
            </span>
            <Icon name="caretRight" size={18} className="flex-none" />
          </motion.button>

          <div className="hidden lg:block">{signOutButton}</div>
        </div>

        <div>
          <Group title="Orders">
            <Row icon="box" title="Your orders" sub={props.orders.live ?? (props.orders.count ? `${props.orders.count} so far` : "None yet")} href="/orders" />
          </Group>

          <Group title="Delivery">
            <Row
              icon="pin"
              title="Addresses"
              sub={props.address ? `${props.address.label}: ${props.address.line}, ${props.address.zone}${props.address.count > 1 ? ` · +${props.address.count - 1} more` : ""}` : "Add one"}
              warn={!props.address}
              href="/account/addresses"
            />
            <Row icon="calendar" title="Delivery days and reminders" sub="On Home, from the ⋯ menu" href="/basket" />
          </Group>

          <Group title="You">
            <Row
              icon="leaf"
              title="Food and household"
              sub={props.goal ? `${people} ${people === 1 ? "person" : "people"} · ${GOAL_LABEL[props.goal] ?? props.goal}` : "Tell us what you're after"}
              onClick={() => setSheet("prefs")}
            />
            <Row icon="account" title="Name and contact" sub={[props.name, props.phone || props.email].filter(Boolean).join(" · ")} onClick={() => setSheet("profile")} />
          </Group>

          <Group title="Notifications">
            <Toggle
              icon="whatsapp"
              title="WhatsApp"
              sub={props.phone ? `Order updates and weekly reminders on ${props.phone}` : "Add a phone number first"}
              on={props.notify.whatsapp && Boolean(props.phone)}
              disabled={!props.phone}
              onChange={(on) => setNotifyChannel("whatsapp", on)}
              onError={failed}
            />
            {props.email && (
              <Toggle icon="send" title="Email" sub={`Receipts and order updates to ${props.email}`} on={props.notify.email} onChange={(on) => setNotifyChannel("email", on)} onError={failed} />
            )}
          </Group>

          <Group title="Help">
            <Row icon={props.help.verb.includes("WhatsApp") ? "whatsapp" : "send"} title={props.help.verb} sub="About an order, your account or anything else" href={props.help.href} external />
            <Row icon="help" title="Questions and answers" href="/faq" />
            <Row icon="map" title="Where we deliver" href="/delivery-areas" />
            <Row icon="leaf" title="About Basket" href="/about" />
          </Group>

          <Group title="Privacy and data">
            <Toggle
              icon="shield"
              title="Help improve Kachi"
              sub="Let the Basket team read your chats with Kachi to make it better. Off unless you turn it on."
              on={props.kachiReview}
              onChange={setKachiReviewConsent}
              onError={failed}
            />
            <Row icon="download" title="Download my data" sub="Your account, addresses and orders, as a file" href="/account/data" download />
            {props.deletionRequested ? (
              <Row icon="trash" title="Deletion requested" sub="We'll finish it within 30 days. Tap to withdraw." onClick={() => setSheet("delete")} />
            ) : (
              <Row icon="trash" title="Delete my account" onClick={() => setSheet("delete")} />
            )}
            <Row icon="doc" title="Terms of service" href="/terms" />
            <Row icon="shield" title="Privacy policy" href="/privacy" />
          </Group>

          <div className="lg:hidden">{signOutButton}</div>
        </div>
      </div>

      <BottomSheet desktopDialog open={sheet === "prefs"} onClose={() => setSheet(null)} title="Food and household">
        <PrefsForm {...props} onSaved={() => saved("Saved")} onError={failed} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "profile"} onClose={() => setSheet(null)} title="Name and contact">
        <ContactForm {...props} onSaved={() => saved("Saved")} onError={failed} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "member"} onClose={() => setSheet(null)} title={m?.state === "member" ? "Your membership" : "Membership"}>
        <MembershipSheet membership={m} onDone={saved} onError={failed} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "invite"} onClose={() => setSheet(null)} title="Invite friends">
        <InviteSheet invite={props.invite} name={props.name} onCopied={() => cart.announce("Link copied")} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "delete"} onClose={() => setSheet(null)} title={props.deletionRequested ? "Keep your account?" : "Delete your account?"}>
        <DeleteSheet requested={Boolean(props.deletionRequested)} onDone={saved} onError={failed} onClose={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "signout"} onClose={() => setSheet(null)} title="Sign out?">
        <p className="mb-3 text-[15px] leading-snug text-muted">Your orders, deliveries and meal plan are saved to your account.</p>
        <form action={signOut}>
          <button className="tap-target mt-5 h-13 w-full rounded-full bg-carbon text-base font-semibold text-white">Sign out</button>
        </form>
        <form action={signOutEverywhere}>
          <button className="tap-target mt-2.5 h-12 w-full rounded-full border border-border text-[15px] font-semibold">Sign out on all devices</button>
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
      <div className="overflow-hidden rounded-tile border-[1.5px] border-border [&>*+*]:border-t [&>*+*]:border-border">{children}</div>
    </div>
  );
}

function Row({ icon, title, sub, warn, onClick, href, external, download }: { icon: IconName; title: string; sub?: string; warn?: boolean; onClick?: () => void; href?: string; external?: boolean; download?: boolean }) {
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
  if (href && (external || download))
    return (
      <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : { download: true })}>
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

/** An on/off row that saves at once and puts itself back if saving fails. */
function Toggle({ icon, title, sub, on, disabled, onChange, onError }: { icon: IconName; title: string; sub: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => Promise<SaveResult>; onError: (m: string) => void }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !value;
      setValue(next);
      const r = await onChange(next);
      if (!r.ok) {
        setValue(!next);
        onError(r.error);
      }
    });
  return (
    <button type="button" role="switch" aria-checked={value} disabled={pending || disabled} onClick={toggle} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left disabled:opacity-60">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-soft-mist">
        <Icon name={icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{title}</b>
        <small className="block text-[13px] text-muted">{sub}</small>
      </span>
      <span aria-hidden className={`relative h-7 w-12 flex-none rounded-full transition-colors ${value ? "bg-carbon" : "bg-soft-mist"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${value ? "left-6" : "left-1"}`} />
      </span>
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

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex h-13 items-center justify-between rounded-input border-[1.5px] border-border pl-3.5 pr-1.5">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer ${label.toLowerCase()}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-mist">
          <Icon name="minus" size={14} />
        </button>
        <b className="min-w-4.5 text-center">{value}</b>
        <button onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label.toLowerCase()}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-mist">
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: press.scale }} onClick={onClick} aria-pressed={on} className={`h-10 rounded-full px-3.5 text-sm ${on ? "bg-carbon font-semibold text-white" : "bg-soft-mist"}`}>
      {children}
    </motion.button>
  );
}

function PrefsForm({ adults, kids, goal, likes, dietaryNotes, onSaved, onError }: Props & { onSaved: () => void; onError: (m: string) => void }) {
  const [a, setA] = useState(adults);
  const [k, setK] = useState(kids);
  const [g, setG] = useState(goal);
  const [l, setL] = useState<string[]>(likes);
  const [notes, setNotes] = useState(dietaryNotes);
  const { pending, run } = useSave(onSaved, onError);
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">Kachi, recipes and your starter sets use this to suggest the right things in the right amounts.</p>
      <span className={LABEL}>Who are you feeding?</span>
      <div className="grid grid-cols-2 gap-2.5">
        <Stepper label="Adults" value={a} onChange={setA} min={1} max={12} />
        <Stepper label="Children" value={k} onChange={setK} min={0} max={12} />
      </div>
      <span className={LABEL}>What are you after most?</span>
      <div className="flex flex-wrap gap-2">
        {MENU_GOALS.map((x) => (
          <Chip key={x.id} on={g === x.starterSlug} onClick={() => setG(x.starterSlug)}>
            {x.label}
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
      <label className={LABEL} htmlFor="diet">
        Allergies, dislikes or things you don&apos;t eat <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea id="diet" rows={2} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="No pork. My son is allergic to peanuts." className={`${FIELD} h-auto resize-none py-3`} />
      <button
        disabled={pending}
        onClick={() => {
          if (!g) return onError("Pick what you're after most.");
          run(() => savePreferences({ adults: a, kids: k, goal: g, likes: l, dietaryNotes: notes }));
        }}
        className={PRIMARY}
      >
        Save
      </button>
    </>
  );
}

function ContactForm({ name, phone, email, hasPassword, onSaved, onError }: Props & { onSaved: () => void; onError: (m: string) => void }) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [e, setE] = useState(email);
  const [pw, setPw] = useState("");
  const { pending, run } = useSave(onSaved, onError);
  const digits = (s: string) => s.replace(/\D/g, "").replace(/^234/, "0");
  // Phone and email are how the account is recovered: changing them asks for the password.
  const contactChanged = digits(p) !== digits(phone) || e.trim().toLowerCase() !== email.trim().toLowerCase();
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">Riders call this number on the day. You sign in with either.</p>
      <label className={LABEL} htmlFor="nm">
        Name
      </label>
      <input id="nm" value={n} onChange={(ev) => setN(ev.target.value)} autoComplete="name" className={FIELD} />
      <label className={LABEL} htmlFor="ph">
        Phone number
      </label>
      <input id="ph" type="tel" inputMode="tel" value={p} onChange={(ev) => setP(ev.target.value)} placeholder="0803 123 4567" autoComplete="tel" className={FIELD} />
      <label className={LABEL} htmlFor="em">
        Email <span className="font-normal text-muted">(optional)</span>
      </label>
      <input id="em" type="email" inputMode="email" value={e} onChange={(ev) => setE(ev.target.value)} autoComplete="email" className={FIELD} />
      {contactChanged && hasPassword && (
        <>
          <label className={LABEL} htmlFor="cpw">
            Current password
          </label>
          <input id="cpw" type="password" value={pw} onChange={(ev) => setPw(ev.target.value)} autoComplete="current-password" className={FIELD} />
          <p className="mt-1.5 text-[13px] text-muted">To keep your account safe, changing your phone or email needs your password.</p>
        </>
      )}
      <button
        disabled={pending || !n.trim() || (contactChanged && hasPassword && !pw)}
        onClick={() => run(() => saveContact({ name: n, phone: p, email: e, currentPassword: contactChanged ? pw : undefined }))}
        className={PRIMARY}
      >
        Save
      </button>
    </>
  );
}

function MembershipSheet({ membership: m, onDone, onError }: { membership: Membership | null; onDone: (message: string) => void; onError: (m: string) => void }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  if (m?.state === "member") {
    return (
      <>
        <p className="mb-3 text-[15px] leading-snug text-muted">
          {m.tierName}, {formatNaira(m.monthlyFee)} a month{m.renews ? `, next due ${m.renews}` : ""}. Nothing is charged automatically: we message you when it&apos;s due, and you pay by transfer.
        </p>
        <Link href="/subscribe" className={`${PRIMARY} flex items-center justify-center`}>
          Change plan
        </Link>
        {asking ? (
          <div className="mt-3 rounded-2xl bg-soft-mist p-4 text-[15px]">
            <p>Member prices and any free delivery end straight away. Your deliveries stay, at standard prices.</p>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelSubscription();
                  if (r.ok) onDone("Membership cancelled");
                  else onError(r.error);
                })
              }
              className="tap-target mt-3 h-12 w-full rounded-full bg-ember font-semibold text-carbon disabled:opacity-60"
            >
              {pending ? "Cancelling…" : "Cancel membership"}
            </button>
            <button onClick={() => setAsking(false)} className={SOFT}>
              Keep it
            </button>
          </div>
        ) : (
          <button onClick={() => setAsking(true)} className={SOFT}>
            Cancel membership
          </button>
        )}
      </>
    );
  }

  if (m?.state === "pending") {
    return (
      <>
        <p className="mb-3 text-[15px] leading-snug text-muted">
          You asked to join {m.tierName} ({formatNaira(m.monthlyFee)} a month). We&apos;ll send payment details within one working day, and it starts once payment arrives.
        </p>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await withdrawPlanRequest();
              if (r.ok) onDone("Request withdrawn");
              else onError(r.error);
            })
          }
          className={SOFT}
        >
          Withdraw request
        </button>
      </>
    );
  }

  return (
    <>
      {m?.state === "declined" && (
        <p className="mb-3 rounded-2xl bg-soft-mist p-3 text-[15px]">
          Your request to join {m.tierName} wasn&apos;t approved{m.note ? `: ${m.note}` : "."} You can ask again any time.
        </p>
      )}
      <ul className="mb-1.5">
        {["Lower prices on everything", "Up to 3 deliveries, for family or the office", "Every recipe, with the method", "Free delivery on Member Plus"].map((perk) => (
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

function InviteSheet({ invite, name, onCopied }: { invite: Props["invite"]; name: string; onCopied: () => void }) {
  const link = typeof window !== "undefined" && invite.code ? `${window.location.origin}/start?ref=${invite.code}` : "";
  const first = name.split(" ")[0];
  const message = `I get my fruit and veg from Basket: fresh, checked by hand, delivered in Lagos. Join with my link and we both get ${formatNaira(invite.reward)} off: ${link}`;
  return (
    <>
      <p className="mb-4 text-[15px] leading-snug text-muted">
        When a friend joins with your link and gets their first delivery, you both get {formatNaira(invite.reward)} credit. It comes off your next order.
      </p>
      {invite.code ? (
        <>
          <div className="rounded-2xl border-[1.5px] border-dashed border-border p-4 text-center">
            <small className="text-[13px] text-muted">{first ? `${first}'s code` : "Your code"}</small>
            <p className="mt-1 text-2xl font-extrabold tracking-[0.15em]">{invite.code}</p>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={`${PRIMARY} flex items-center justify-center gap-2`}>
            <Icon name="whatsapp" size={20} />
            Share on WhatsApp
          </a>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(link).then(onCopied, () => {});
            }}
            className={SOFT}
          >
            Copy link
          </button>
        </>
      ) : (
        <p className="text-[15px]">Your invite code isn&apos;t ready yet. Try again in a moment.</p>
      )}
      <p className="mt-4 text-center text-[13px] text-muted">
        {invite.invited ? `${invite.invited} joined with your link · ${invite.rewarded} had their first delivery` : "Nobody's joined with your link yet."}
        {invite.credit > 0 ? ` · ${formatNaira(invite.credit)} credit to spend` : ""}
      </p>
    </>
  );
}

function DeleteSheet({ requested, onDone, onError, onClose }: { requested: boolean; onDone: (m: string) => void; onError: (m: string) => void; onClose: () => void }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<SaveResult>, message: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) onDone(message);
      else onError(r.error);
    });
  if (requested)
    return (
      <>
        <p className="mb-3 text-[15px] leading-snug text-muted">You asked us to delete your account. Until we do, you can change your mind and keep everything.</p>
        <button disabled={pending} onClick={() => run(cancelDeletion, "Your account stays")} className={PRIMARY}>
          Keep my account
        </button>
        <button onClick={onClose} className={SOFT}>
          Close
        </button>
      </>
    );
  return (
    <>
      <p className="mb-3 text-[15px] leading-snug text-muted">
        We&apos;ll delete your account, addresses, deliveries and Kachi chats within 30 days. Order records we must keep for tax are kept without your name and contact details. Any credit is lost.
      </p>
      <button disabled={pending} onClick={() => run(requestDeletion, "We've got your request")} className="tap-target mt-5 h-13 w-full rounded-full bg-ember text-base font-semibold text-carbon disabled:opacity-60">
        Delete my account
      </button>
      <button onClick={onClose} className={SOFT}>
        Keep it
      </button>
    </>
  );
}
