"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, LinkButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { disablePush, enablePush, isInstalled, openGetApp, pushNeedsInstall } from "@/components/app/pwa";
import { formatNaira, GOAL_LABEL, PRODUCE_PREFERENCE_LABEL, PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";
import { MENU_GOALS } from "@/lib/menu-types";
import { openCookieSettings } from "@/lib/analytics";
import { cancelSubscription, withdrawPlanRequest } from "@/app/(site)/subscribe/actions";
import { payForPlan } from "@/lib/payment-actions";
import { PayButton } from "@/components/payments/pay-button";
import { StreakCard, type StreakCardData } from "@/components/streak/streak-card";
import { TypeToConfirm } from "@/components/ui/type-to-confirm";
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
  | { state: "member"; tierName: string; tierSlug: string; monthlyFee: number; renews: string | null; paidThisMonth: boolean }
  | { state: "pending"; tierName: string; tierSlug: string; monthlyFee: number; renews: null }
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
  /** Paystack is set up: the month can be paid here. */
  online: boolean;
  streak: StreakCardData;
  emailVerified: boolean;
  /** Whether they've had the feedback reward yet, and what it is. */
  feedback: { rewarded: boolean; reward: number };
  orders: { count: number; live: string | null };
  notify: { whatsapp: boolean; email: boolean; push: boolean };
  /** The customer's baskets, by name, and how many come every week. */
  baskets: { names: string[]; running: number };
  /** Free accounts: whether the one trial basket is still to use. */
  trial: "available" | "used" | null;
  savedRecipes: number;
  /** Devices with app notifications turned on. */
  pushDevices: number;
  invite: { code: string | null; reward: number; invited: number; rewarded: number; credit: number };
  kachiReview: boolean;
  /** How many notes Kachi keeps about them (Account > What Kachi knows). */
  kachiMemories: number;
  deletionRequested: string | null;
  help: { href: string; verb: string };
};

type Sheet = "prefs" | "profile" | "member" | "invite" | "delete" | "signout" | null;

/** Icon tiles, one colour per kind of thing, so a row can be found by colour before it's read. */
type Tint = "mint" | "sky" | "lavender" | "sun" | "ember" | "mist" | "carbon";
const TINT: Record<Tint, string> = {
  mint: "bg-mint-pop/35 text-carbon",
  sky: "bg-sky-wash text-carbon",
  lavender: "bg-lavender text-carbon",
  sun: "bg-sunburst/45 text-carbon",
  ember: "bg-ember/20 text-carbon",
  mist: "bg-soft-mist text-carbon",
  carbon: "bg-carbon text-paper-white",
};

/* Shared form styles for every sheet on this page: the same fields as checkout. */
const FIELD =
  "h-12 w-full rounded-xl border border-hairline bg-surface px-3.5 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-carbon focus:shadow-[0_0_0_3px_rgb(0_0_0/0.08)]";
const LABEL = "mb-1.5 mt-4 block text-[13px] font-semibold text-carbon/70";
const LEDE = "text-[15px] leading-relaxed text-muted";

/**
 * Me: a settings screen. One column, the way people expect to find their
 * account: who they are at the top, the two things worth a glance
 * (membership, invite credit), then grouped lists of everything they can
 * set. Every row is the same height, every group the same shape, and every
 * sheet uses the same fields and buttons. Saving shows a toast above any
 * open sheet.
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

  // Known only in the browser: is Basket installed on this device, and can it get notifications here yet?
  const [device, setDevice] = useState<{ installed: boolean; needsInstall: boolean } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDevice({ installed: isInstalled(), needsInstall: pushNeedsInstall() }), 0);
    return () => window.clearTimeout(t);
  }, []);

  /** App notifications: on means this device is subscribed too, not just the setting. */
  const setPush = async (on: boolean): Promise<SaveResult> => {
    if (!on) {
      await disablePush();
      return setNotifyChannel("push", false);
    }
    const r = await enablePush();
    if (r === "on") return { ok: true };
    if (r === "needs-install") {
      openGetApp();
      return { ok: false, error: "On iPhone, add Basket to your home screen first." };
    }
    if (r === "denied") return { ok: false, error: "Notifications are blocked for Basket in this browser's settings." };
    if (r === "unsupported") return { ok: false, error: "This browser can't show notifications." };
    return { ok: false, error: "That didn't work. Try again in a moment." };
  };

  const people = props.adults + props.kids;
  const m = props.membership;
  const initial = props.name.trim().charAt(0).toUpperCase() || "?";

  const todo: { icon: IconName; title: string; sub: string; href?: string; sheet?: Sheet }[] = [];
  if (!props.address) todo.push({ icon: "pin", title: "Add your delivery address", sub: "So we know which days we come to you", href: "/account/addresses?next=/account" });
  if (!props.phone) todo.push({ icon: "phone", title: "Add a phone number", sub: "The rider calls it on the day", sheet: "profile" });
  if (props.email && !props.emailVerified) todo.push({ icon: "send", title: "Confirm your email", sub: "So receipts and reminders reach you", href: "/verify-email" });

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8">
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">Me</h1>

        {/* Who you are */}
        <button
          type="button"
          onClick={() => setSheet("profile")}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline transition-[transform,background-color] hover:bg-black/[0.015] active:scale-[0.995]"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-carbon to-carbon/75 text-[22px] font-semibold text-paper-white" aria-hidden>
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[19px] leading-tight font-semibold tracking-[-0.01em]">{props.name || "Add your name"}</b>
            <span className="mt-0.5 block truncate text-[14px] text-muted">{[props.phone, props.email].filter(Boolean).join(" · ") || "Name, phone and email"}</span>
          </span>
          <Icon name="caretRight" size={16} className="shrink-0 text-carbon/35" />
        </button>

        {/* Weeks in a row with a basket: the reason to come back. */}
        <StreakCard data={props.streak} />

        {todo.length > 0 && (
          <Group title="To do">
            {todo.map((t) =>
              t.href ? (
                <Row key={t.title} icon={t.icon} tint="sun" title={t.title} sub={t.sub} href={t.href} />
              ) : (
                <Row key={t.title} icon={t.icon} tint="sun" title={t.title} sub={t.sub} onClick={() => setSheet(t.sheet ?? null)} />
              ),
            )}
          </Group>
        )}

        {/* The two things worth a glance */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Tile
            onClick={() => setSheet("member")}
            tone={m?.state === "member" ? "bg-mint-pop/25" : m?.state === "pending" ? "bg-sunburst/30" : "bg-lavender/70"}
            icon="star"
            eyebrow="Membership"
            title={m?.state === "member" ? m.tierName : m?.state === "pending" ? "On its way" : "Not a member"}
            sub={
              m?.state === "member"
                ? `Next due ${m.renews ?? "monthly"}`
                : m?.state === "pending"
                  ? `Waiting for payment: ${m.tierName}`
                  : m?.state === "declined"
                    ? "Your last request wasn't approved"
                    : props.trial === "used"
                      ? "Join to keep your baskets coming"
                      : "Try your first basket, no membership needed"
            }
          />
          <Tile
            onClick={() => setSheet("invite")}
            tone="bg-surface ring-1 ring-hairline"
            icon="gift"
            eyebrow="Invite friends"
            title={props.invite.credit > 0 ? `${formatNaira(props.invite.credit)} credit` : `Get ${formatNaira(props.invite.reward)} each`}
            sub={props.invite.credit > 0 ? "Comes off your next order" : "After their first delivery"}
          />
        </div>

        <Group title="Give and share">
          <Row icon="gift" tint="ember" title="Gift a basket" sub="Fresh fruit and veg for someone you love" href="/gift" />
          <Row
            icon="send"
            tint="sun"
            title="Tell us how we're doing"
            sub={props.feedback.rewarded ? "Two minutes, one question at a time" : `Two minutes, and ${formatNaira(props.feedback.reward)} credit for you`}
            href="/feedback"
          />
        </Group>

        <Group title="Orders">
          <Row icon="box" tint="mint" title="Your orders" sub={props.orders.live ?? (props.orders.count ? `${props.orders.count} so far` : "None yet")} href="/orders" />
        </Group>

        <Group title="Delivery">
          <Row
            icon="pin"
            tint="sky"
            title="Addresses"
            sub={props.address ? `${props.address.label} · ${props.address.line}${props.address.count > 1 ? ` · +${props.address.count - 1}` : ""}` : "None yet"}
            href="/account/addresses"
          />
          <Row
            icon="parcel"
            tint="sky"
            title={props.baskets.names.length > 1 ? "Your baskets" : "Your basket"}
            sub={
              props.baskets.names.length === 0
                ? "Start one on Home"
                : `${props.baskets.names.join(", ")}${props.baskets.running ? ` · ${props.baskets.running === props.baskets.names.length ? "every week" : `${props.baskets.running} every week`}` : ""}`
            }
            href="/basket"
          />
        </Group>

        <Group title="You">
          <Row
            icon="leaf"
            tint="mint"
            title="Food and household"
            sub={props.goal ? `${people} ${people === 1 ? "person" : "people"} · ${GOAL_LABEL[props.goal] ?? props.goal}` : "Tell us what you're after"}
            onClick={() => setSheet("prefs")}
          />
          <Row icon="favourite" tint="ember" title="Saved recipes" sub={props.savedRecipes ? `${props.savedRecipes} saved` : "Tap the heart on a recipe to keep it"} href="/recipes/saved" />
          <Row icon="account" tint="mist" title="Name and contact" sub={[props.name, props.phone || props.email].filter(Boolean).join(" · ")} onClick={() => setSheet("profile")} />
        </Group>

        {device && !device.installed && (
          <Group title="App">
            <Row icon="device" tint="mint" title="Get the app" sub="Basket on your home screen, one tap away" onClick={openGetApp} />
          </Group>
        )}

        <Group title="Notifications" footer="Your basket reminders, a few days before each delivery, and order updates go to whichever you leave on. Password links always come through.">
          <Toggle
            icon="whatsapp"
            tint="mint"
            title="WhatsApp"
            sub={props.phone ? props.phone : "Add a phone number first"}
            on={props.notify.whatsapp && Boolean(props.phone)}
            disabled={!props.phone}
            onChange={(on) => setNotifyChannel("whatsapp", on)}
            onError={failed}
          />
          {props.email && <Toggle icon="send" tint="sky" title="Email" sub={props.email} on={props.notify.email} onChange={(on) => setNotifyChannel("email", on)} onError={failed} />}
          <Toggle
            icon="bell"
            tint="sun"
            title="App notifications"
            sub={device?.needsInstall ? "Add Basket to your home screen first" : "On this device"}
            on={props.notify.push && props.pushDevices > 0}
            onChange={setPush}
            onError={failed}
          />
        </Group>

        <Group title="Help">
          <Row icon={props.help.verb.includes("WhatsApp") ? "whatsapp" : "send"} tint="lavender" title={props.help.verb} sub="About an order, your account or anything else" href={props.help.href} external />
          <Row icon="help" tint="lavender" title="Questions and answers" href="/faq" />
          <Row icon="map" tint="lavender" title="Where we deliver" href="/delivery-areas" />
          <Row icon="leaf" tint="lavender" title="About Basket" href="/about" />
        </Group>

        <Group title="Privacy and data">
          <Row
            icon="spark"
            tint="mist"
            title="What Kachi knows"
            sub={props.kachiMemories ? `${props.kachiMemories} ${props.kachiMemories === 1 ? "note" : "notes"} she keeps for you` : "Nothing yet. See or delete what she remembers."}
            href="/account/kachi"
          />
          <Toggle
            icon="shield"
            tint="mist"
            title="Help improve Kachi"
            sub="Let the Basket team read your Kachi chats. Off unless you turn it on."
            on={props.kachiReview}
            onChange={setKachiReviewConsent}
            onError={failed}
          />
          <Row icon="download" tint="mist" title="Download my data" sub="Your account, addresses and orders, as a file" href="/account/data" download />
          <Row icon="doc" tint="mist" title="Terms of service" href="/terms" />
          <Row icon="shield" tint="mist" title="Privacy policy" href="/privacy" />
          <Row icon="shield" tint="mist" title="Cookie settings" sub="Essential, or with analytics" onClick={openCookieSettings} />
        </Group>

        <Group>
          <Row title="Sign out" onClick={() => setSheet("signout")} plain />
          <Row
            title={props.deletionRequested ? "Deletion requested · keep my account" : "Delete my account"}
            onClick={() => setSheet("delete")}
            plain
            danger={!props.deletionRequested}
          />
        </Group>
      </div>

      <BottomSheet desktopDialog open={sheet === "prefs"} onClose={() => setSheet(null)} title="Food and household">
        <PrefsForm {...props} onSaved={() => saved("Saved")} onError={failed} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "profile"} onClose={() => setSheet(null)} title="Name and contact">
        <ContactForm {...props} onSaved={() => saved("Saved")} onError={failed} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "member"} onClose={() => setSheet(null)} title={m?.state === "member" ? "Your membership" : "Membership"}>
        <MembershipSheet membership={m} online={props.online} onDone={saved} onError={failed} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "invite"} onClose={() => setSheet(null)} title="Invite friends">
        <InviteSheet invite={props.invite} name={props.name} onCopied={() => cart.announce("Link copied")} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "delete"} onClose={() => setSheet(null)} title={props.deletionRequested ? "Keep your account?" : "Delete your account?"}>
        <DeleteSheet requested={Boolean(props.deletionRequested)} onDone={saved} onError={failed} onClose={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet desktopDialog open={sheet === "signout"} onClose={() => setSheet(null)} title="Sign out?">
        <p className={LEDE}>Your orders, deliveries and meal plan are saved to your account.</p>
        <Actions>
          <form action={signOut}>
            <Button type="submit" size="lg" className="w-full">
              Sign out
            </Button>
          </form>
          <form action={signOutEverywhere}>
            <Button type="submit" size="lg" variant="secondary" className="w-full">
              Sign out on all devices
            </Button>
          </form>
        </Actions>
      </BottomSheet>
    </div>
  );
}

/* -------------------------------- building blocks ------------------------------- */

function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      {title && <h2 className="mb-2 px-4 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">{title}</h2>}
      <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline">{children}</div>
      {footer && <p className="mt-2 px-4 text-[13px] leading-snug text-muted">{footer}</p>}
    </section>
  );
}

function IconTile({ icon, tint }: { icon: IconName; tint: Tint }) {
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${TINT[tint]}`} aria-hidden>
      <Icon name={icon} size={17} weight="bold" />
    </span>
  );
}

/**
 * One row of a grouped list. The divider starts where the text does, as in a
 * settings list, and the last row has none.
 */
function Row({
  icon,
  tint = "mist",
  title,
  sub,
  onClick,
  href,
  external,
  download,
  plain,
  danger,
}: {
  icon?: IconName;
  tint?: Tint;
  title: string;
  sub?: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  download?: boolean;
  /** No icon or chevron: Sign out, Delete. */
  plain?: boolean;
  danger?: boolean;
}) {
  const body = (
    <>
      {icon && !plain && <IconTile icon={icon} tint={tint} />}
      <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 border-b border-hairline py-2.5 pr-4 group-last/row:border-b-0">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[16px] leading-snug ${plain ? `text-center font-semibold ${danger ? "text-[#c2410c]" : "text-carbon"}` : "font-medium"}`}>{title}</span>
          {sub && <span className="block truncate text-[13px] leading-snug text-muted">{sub}</span>}
        </span>
        {!plain && <Icon name={external ? "send" : "caretRight"} size={external ? 14 : 15} className="shrink-0 text-carbon/30" />}
      </span>
    </>
  );
  const cls = "group/row flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-black/[0.025] active:bg-black/[0.05]";
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
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** An on/off row that saves at once and puts itself back if saving fails. */
function Toggle({ icon, tint, title, sub, on, disabled, onChange, onError }: { icon: IconName; tint: Tint; title: string; sub: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => Promise<SaveResult>; onError: (m: string) => void }) {
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
    <button type="button" role="switch" aria-checked={value} aria-label={title} disabled={pending || disabled} onClick={toggle} className="group/row flex w-full items-center gap-3 pl-4 text-left disabled:opacity-50">
      <IconTile icon={icon} tint={tint} />
      <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 border-b border-hairline py-2.5 pr-4 group-last/row:border-b-0">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] leading-snug font-medium">{title}</span>
          <span className="block text-[13px] leading-snug text-muted">{sub}</span>
        </span>
        <span aria-hidden className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${value ? "bg-[#1f9d55]" : "bg-black/[0.12]"}`}>
          <span className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-[left] duration-200 ${value ? "left-[22px]" : "left-[2px]"}`} />
        </span>
      </span>
    </button>
  );
}

function Tile({ onClick, tone, icon, eyebrow, title, sub }: { onClick: () => void; tone: string; icon: IconName; eyebrow: string; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl p-4 text-left transition-transform active:scale-[0.985] ${tone}`}>
      <span className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-carbon/65">{eyebrow}</span>
        <span className="flex size-8 items-center justify-center rounded-full bg-white/80">
          <Icon name={icon} size={16} weight="bold" />
        </span>
      </span>
      <span>
        <b className="block text-[19px] leading-tight font-semibold tracking-[-0.01em]">{title}</b>
        <span className="mt-0.5 block text-[13px] text-carbon/65">{sub}</span>
      </span>
    </button>
  );
}

/** The buttons at the foot of a sheet, stacked and full width. */
function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 grid gap-2.5">{children}</div>;
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
    <div className="flex h-12 items-center justify-between rounded-xl border border-hairline pr-1.5 pl-3.5">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer ${label.toLowerCase()}`} className="flex size-9 items-center justify-center rounded-full bg-soft-mist transition-transform active:scale-90 disabled:opacity-40">
          <Icon name="minus" size={14} weight="bold" />
        </button>
        <b className="min-w-6 text-center tabular-nums">{value}</b>
        <button type="button" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label.toLowerCase()}`} className="flex size-9 items-center justify-center rounded-full bg-soft-mist transition-transform active:scale-90 disabled:opacity-40">
          <Icon name="plus" size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 rounded-full px-4 text-[14px] transition-[background-color,color,transform] active:scale-[0.97] ${on ? "bg-carbon font-semibold text-paper-white" : "bg-soft-mist text-carbon hover:bg-black/[0.1]"}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------ sheets ------------------------------------ */

function PrefsForm({ adults, kids, goal, likes, dietaryNotes, onSaved, onError }: Props & { onSaved: () => void; onError: (m: string) => void }) {
  const [a, setA] = useState(adults);
  const [k, setK] = useState(kids);
  const [g, setG] = useState(goal);
  const [l, setL] = useState<string[]>(likes);
  const [notes, setNotes] = useState(dietaryNotes);
  const { pending, run } = useSave(onSaved, onError);
  return (
    <>
      <p className={LEDE}>Kachi, recipes and your starter sets use this to suggest the right things in the right amounts.</p>
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
      <Actions>
        <Button
          size="lg"
          className="w-full"
          loading={pending}
          onClick={() => {
            if (!g) return onError("Pick what you're after most.");
            run(() => savePreferences({ adults: a, kids: k, goal: g, likes: l, dietaryNotes: notes }));
          }}
        >
          Save
        </Button>
      </Actions>
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
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        run(() => saveContact({ name: n, phone: p, email: e, currentPassword: contactChanged ? pw : undefined }));
      }}
    >
      <p className={LEDE}>Riders call this number on the day. You sign in with either.</p>
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
      <Actions>
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!n.trim() || (contactChanged && hasPassword && !pw)}>
          Save
        </Button>
      </Actions>
    </form>
  );
}

function MembershipSheet({ membership: m, online, onDone, onError }: { membership: Membership | null; online: boolean; onDone: (message: string) => void; onError: (m: string) => void }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  if (m?.state === "member") {
    return (
      <>
        <div className="rounded-2xl bg-mint-pop/20 p-4">
          <p className="text-[13px] font-semibold text-carbon/65">Your plan</p>
          <p className="mt-0.5 text-[22px] leading-tight font-semibold tracking-[-0.01em]">{m.tierName}</p>
          <p className="mt-1 text-[14px] text-carbon/70">
            {formatNaira(m.monthlyFee)} a month{m.renews ? ` · next due ${m.renews}` : ""}
          </p>
        </div>
        {online &&
          (m.paidThisMonth ? (
            <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-[#0f7a48]">
              <Icon name="check" size={18} /> This month is paid
            </p>
          ) : (
            <PayButton start={payForPlan.bind(null, m.tierSlug)} label={`Pay this month · ${formatNaira(m.monthlyFee)}`} className="mt-4" onPaid={() => onDone("Payment received")} />
          ))}
        <p className={`${LEDE} mt-4`}>Nothing is charged automatically: we message you when it&apos;s due, and you pay it yourself{online ? ", here" : " by transfer"}.</p>
        {asking ? (
          <div className="mt-5 rounded-2xl bg-soft-mist p-4">
            <p className="text-[15px]">Member prices and any free delivery end straight away, and your baskets stop coming every week. Their produce stays saved.</p>
            <Actions>
              <Button
                size="lg"
                variant="danger"
                className="w-full"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await cancelSubscription();
                    if (r.ok) onDone("Membership cancelled");
                    else onError(r.error);
                  })
                }
              >
                Cancel membership
              </Button>
              <Button size="lg" variant="secondary" className="w-full" onClick={() => setAsking(false)}>
                Keep it
              </Button>
            </Actions>
          </div>
        ) : (
          <Actions>
            <LinkButton href="/subscribe" size="lg" className="flex w-full justify-center">
              Change plan
            </LinkButton>
            <Button size="lg" variant="secondary" className="w-full" onClick={() => setAsking(true)}>
              Cancel membership
            </Button>
          </Actions>
        )}
      </>
    );
  }

  if (m?.state === "pending") {
    return (
      <>
        <p className={LEDE}>
          You asked to join {m.tierName} ({formatNaira(m.monthlyFee)} a month).{" "}
          {online ? "Pay the first month and it starts straight away." : "We'll send payment details within one working day, and it starts once payment arrives."}
        </p>
        {online && <PayButton start={payForPlan.bind(null, m.tierSlug)} label={`Pay ${formatNaira(m.monthlyFee)} and start`} className="mt-4" onPaid={() => onDone(`Welcome to ${m.tierName}`)} />}
        <Actions>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await withdrawPlanRequest();
                if (r.ok) onDone("Request withdrawn");
                else onError(r.error);
              })
            }
          >
            Withdraw request
          </Button>
        </Actions>
      </>
    );
  }

  return (
    <>
      {m?.state === "declined" && (
        <p className="mb-4 rounded-2xl bg-soft-mist p-4 text-[15px]">
          Your request to join {m.tierName} wasn&apos;t approved{m.note ? `: ${m.note}` : "."} You can ask again any time.
        </p>
      )}
      <ul className="divide-y divide-hairline rounded-2xl ring-1 ring-hairline">
        {["Your baskets every week, at member prices", "Up to 3 baskets, like one for Mum", "A reminder before each delivery. Nothing is charged automatically", "Every recipe, with the method", "Free delivery on Member Plus"].map((perk) => (
          <li key={perk} className="flex items-center gap-3 px-4 py-3 text-[15px]">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-pop/40">
              <Icon name="checkPlain" size={13} weight="bold" />
            </span>
            {perk}
          </li>
        ))}
      </ul>
      <Actions>
        <LinkButton href="/subscribe" size="lg" className="flex w-full justify-center">
          See plans
        </LinkButton>
      </Actions>
    </>
  );
}

function InviteSheet({ invite, name, onCopied }: { invite: Props["invite"]; name: string; onCopied: () => void }) {
  const link = typeof window !== "undefined" && invite.code ? `${window.location.origin}/start?ref=${invite.code}` : "";
  const first = name.split(" ")[0];
  const message = `I get my fruit and veg from Basket: fresh, checked by hand, delivered in Lagos. Join with my link and we both get ${formatNaira(invite.reward)} off: ${link}`;
  return (
    <>
      <p className={LEDE}>When a friend joins with your link and gets their first delivery, you both get {formatNaira(invite.reward)} credit. It comes off your next order.</p>
      {invite.code ? (
        <>
          <div className="mt-5 rounded-2xl bg-grouped p-5 text-center ring-1 ring-hairline">
            <p className="text-[13px] font-semibold text-carbon/60">{first ? `${first}'s code` : "Your code"}</p>
            <p className="mt-1 font-mono text-[26px] font-bold tracking-[0.18em]">{invite.code}</p>
          </div>
          <Actions>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-control bg-carbon text-base font-semibold text-paper-white transition-transform active:scale-[0.98]">
              <Icon name="whatsapp" size={20} />
              Share on WhatsApp
            </a>
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={() => {
                navigator.clipboard?.writeText(link).then(onCopied, () => {});
              }}
            >
              Copy link
            </Button>
          </Actions>
        </>
      ) : (
        <p className="mt-4 text-[15px]">Your invite code isn&apos;t ready yet. Try again in a moment.</p>
      )}
      <dl className="mt-5 grid grid-cols-3 divide-x divide-hairline rounded-2xl text-center ring-1 ring-hairline">
        <Stat label="Joined" value={String(invite.invited)} />
        <Stat label="First delivery" value={String(invite.rewarded)} />
        <Stat label="Credit" value={formatNaira(invite.credit)} />
      </dl>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <dd className="text-[17px] font-semibold tabular-nums">{value}</dd>
      <dt className="text-[12px] text-muted">{label}</dt>
    </div>
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
        <p className={LEDE}>You asked us to delete your account. Until we do, you can change your mind and keep everything.</p>
        <Actions>
          <Button size="lg" className="w-full" loading={pending} onClick={() => run(cancelDeletion, "Your account stays")}>
            Keep my account
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        </Actions>
      </>
    );
  return (
    <>
      <p className={LEDE}>
        We&apos;ll delete your account, addresses, deliveries and Kachi chats within 30 days. Order records we must keep for tax are kept without your name and contact details. Any credit is lost.
      </p>
      <div className="mt-5">
        <TypeToConfirm phrase="Delete account">
          {(ready) => (
            <Actions>
              <Button size="lg" variant="danger" className="w-full" loading={pending} disabled={!ready} onClick={() => run(requestDeletion, "We've got your request")}>
                Delete my account
              </Button>
              <Button size="lg" variant="secondary" className="w-full" onClick={onClose}>
                Keep it
              </Button>
            </Actions>
          )}
        </TypeToConfirm>
      </div>
    </>
  );
}
