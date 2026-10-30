"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { formatNaira } from "@/lib/format";
import { GIFT_DESIGNS } from "@/lib/gift-config";
import { GiftCard } from "@/components/gift/gift-card";
import { openGift } from "../actions";

type Card = { design: string; amount: number; to: string; from: string; message: string | null };

/*
 * /gift/<code>. For the person it's for: a wrapped box they tap to unwrap,
 * the card with the note, and one button to open it into their account.
 * For the sender: the card, and ways to share the link until it's opened.
 */
export function GiftReveal(p: {
  code: string;
  link: string;
  role: "sender" | "recipient";
  justSent: boolean;
  signedIn: boolean;
  status: "ready" | "mine" | "taken" | "unpaid";
  openedOn: string | null;
  card: Card;
}) {
  const d = GIFT_DESIGNS.find((x) => x.id === p.card.design) ?? GIFT_DESIGNS[0];
  return (
    <div className="hm min-h-svh text-carbon" style={{ backgroundColor: d.bg }}>
      <header className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center">
        <Link href="/" className="logo-wordmark text-[22px] leading-none" style={{ color: d.ink }}>
          BasketNG
        </Link>
      </header>
      <main className="mx-auto w-[min(520px,calc(100%-32px))] pt-2 pb-16">{p.role === "sender" ? <Sender {...p} /> : <Recipient {...p} />}</main>
    </div>
  );
}

function Sender(p: Parameters<typeof GiftReveal>[0]) {
  const [copied, setCopied] = useState(false);
  const text = `${p.card.to.split(/\s+/)[0]}, I've sent you a basket of fresh fruit and veg from BasketNG. Open it here: ${p.link}`;
  const share = async () => {
    haptic("selection");
    try {
      if (navigator.share) await navigator.share({ title: "A basket for you", text, url: p.link });
      else {
        await navigator.clipboard.writeText(p.link);
        setCopied(true);
      }
    } catch {
      /* closed the share sheet */
    }
  };
  return (
    <div className="text-center">
      <h1 className="mt-4 text-[clamp(2rem,7vw,2.5rem)] leading-[1.04] font-semibold tracking-[-0.045em] text-balance">
        {p.status === "taken" || p.status === "mine"
          ? `${p.card.to.split(/\s+/)[0]} opened it.`
          : p.status === "unpaid"
            ? "This gift isn't paid yet."
            : p.justSent
              ? "Your gift is ready."
              : `Your gift for ${p.card.to.split(/\s+/)[0]}.`}
      </h1>
      <p className="mx-auto mt-3 max-w-[24rem] text-[16px] leading-snug text-carbon/65">
        {p.status === "taken" || p.status === "mine"
          ? `They opened it${p.openedOn ? ` on ${p.openedOn}` : ""}. Their basket is on you.`
          : p.status === "unpaid"
            ? "Start again and it'll be sent the moment it's paid."
            : "Share the link and they'll open it, pick their fruit and veg, and we'll deliver."}
      </p>
      <motion.div initial={{ y: 16, rotate: -3, opacity: 0 }} animate={{ y: 0, rotate: -1.5, opacity: 1 }} transition={spring.juicy} className="mt-7">
        <GiftCard {...p.card} />
      </motion.div>
      {p.status === "ready" && (
        <div className="mt-7 grid gap-2.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptic("selection")}
            className="flex h-14 items-center justify-center rounded-full bg-[#25d366] text-[16px] font-semibold text-carbon"
          >
            Send it on WhatsApp
          </a>
          <button type="button" onClick={share} className="flex h-12 items-center justify-center rounded-full bg-paper-white/70 text-[15px] font-semibold">
            {copied ? "Link copied" : "Share the link"}
          </button>
        </div>
      )}
      <Link href={p.status === "unpaid" ? "/gift" : "/account"} className="mt-5 inline-block text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4">
        {p.status === "unpaid" ? "Start a gift" : "Back to my account"}
      </Link>
    </div>
  );
}

function Recipient(p: Parameters<typeof GiftReveal>[0]) {
  const still = useReducedMotion();
  const [unwrapped, setUnwrapped] = useState(p.status !== "ready" || Boolean(still));
  const [state, setState] = useState<"idle" | "opened" | "account" | "error">(p.status === "mine" ? "opened" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const d = GIFT_DESIGNS.find((x) => x.id === p.card.design) ?? GIFT_DESIGNS[0];
  const first = p.card.to.split(/\s+/)[0];

  if (p.status === "taken" || p.status === "unpaid") {
    return (
      <div className="pt-10 text-center">
        <p className="text-[56px]" aria-hidden>
          🎁
        </p>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">{p.status === "taken" ? "This gift has been opened." : "This gift isn't ready yet."}</h1>
        <p className="mt-2 text-carbon/65">{p.status === "taken" ? "If it was meant for you, ask the person who sent it." : "Check back once it's been paid for."}</p>
        <Link href="/" className="mt-7 inline-flex h-12 items-center rounded-full bg-carbon px-6 font-semibold text-paper-white">
          See BasketNG
        </Link>
      </div>
    );
  }

  const claim = () => {
    setError(null);
    start(async () => {
      const r = await openGift(p.code);
      if (r.ok) {
        haptic("success");
        track("gift_claimed", { amount: r.amount });
        setState("opened");
      } else if ("needsAccount" in r) setState("account");
      else {
        haptic("error");
        setError(r.error);
        setState("error");
      }
    });
  };

  if (!unwrapped) {
    return (
      <div className="flex min-h-[70svh] flex-col items-center justify-center text-center">
        <p className="text-[15px] font-semibold" style={{ color: d.ink }}>
          {first}, {p.card.from} sent you something
        </p>
        <motion.button
          type="button"
          onClick={() => {
            haptic("success");
            track("gift_opened");
            setUnwrapped(true);
          }}
          aria-label="Unwrap your gift"
          className="relative mt-8 h-52 w-52"
          animate={{ rotate: [0, -4, 4, -3, 3, 0], y: [0, -6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }}
          whileTap={{ scale: 0.92 }}
        >
          {/* The box and its lid, in the card's colours. */}
          <span className="absolute inset-x-3 bottom-0 h-36 rounded-[22px]" style={{ backgroundColor: d.ribbon }} />
          <span className="absolute inset-x-0 top-6 h-14 rounded-[18px] brightness-110" style={{ backgroundColor: d.ribbon }} />
          <span className="absolute inset-y-6 left-1/2 w-6 -translate-x-1/2 bg-paper-white/85" />
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[56px] leading-none">🎀</span>
        </motion.button>
        <p className="mt-8 text-[14px] text-carbon/60">Tap to unwrap</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Burst />
      <motion.div initial={{ scale: 0.6, y: 40, rotate: -8, opacity: 0 }} animate={{ scale: 1, y: 0, rotate: -1.5, opacity: 1 }} transition={spring.juicy} className="mt-6">
        <GiftCard {...p.card} />
      </motion.div>

      {state === "opened" ? (
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.smooth}>
          <h1 className="mt-8 text-[clamp(1.9rem,7vw,2.4rem)] leading-[1.05] font-semibold tracking-[-0.04em]">{formatNaira(p.card.amount)} is in your account.</h1>
          <p className="mx-auto mt-2 max-w-[24rem] text-[16px] text-carbon/65">Pick the fruit and veg you&apos;d like and it comes off your basket. Say thank you to {p.card.from}!</p>
          <Link href="/shop" className="mt-7 flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white">
            Pick my basket
          </Link>
        </motion.div>
      ) : state === "account" ? (
        <div>
          <h1 className="mt-8 text-[clamp(1.9rem,7vw,2.4rem)] leading-[1.05] font-semibold tracking-[-0.04em]">One step to open it.</h1>
          <p className="mx-auto mt-2 max-w-[24rem] text-[16px] text-carbon/65">Create a free account, or sign in, and your {formatNaira(p.card.amount)} is added straight away.</p>
          <div className="mt-7 grid gap-2.5">
            <Link href="/start" className="flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white">
              Create a free account
            </Link>
            <Link href={`/login?next=/gift/${p.code}`} className="flex h-12 items-center justify-center rounded-full bg-paper-white/70 text-[15px] font-semibold">
              I have an account
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="mt-8 text-[clamp(1.9rem,7vw,2.4rem)] leading-[1.05] font-semibold tracking-[-0.04em]">A basket for you, {first}.</h1>
          <p className="mx-auto mt-2 max-w-[24rem] text-[16px] text-carbon/65">
            {formatNaira(p.card.amount)} of fresh fruit and veg from {p.card.from}. You choose what&apos;s in it; we deliver across Lagos.
          </p>
          <button
            type="button"
            onClick={claim}
            disabled={pending}
            className="mt-7 flex h-14 w-full items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white disabled:opacity-60"
          >
            {pending ? "Opening…" : "Open my gift"}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-[14px] text-carbon/70">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Produce bursting out of the box, once. */
function Burst() {
  const still = useReducedMotion();
  const bits = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ e: ["🍊", "🥑", "🍍", "🥭", "🍉", "🥕", "🍋", "🍌"][i % 8], a: (i / 16) * Math.PI * 2, r: 120 + (i % 3) * 50 })), []);
  if (still) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[35%] z-40 flex justify-center" aria-hidden>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute text-[26px]"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: Math.cos(b.a) * b.r, y: Math.sin(b.a) * b.r + 80, opacity: 0, scale: 1.1, rotate: (i % 2 ? 1 : -1) * 200 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {b.e}
        </motion.span>
      ))}
    </div>
  );
}
