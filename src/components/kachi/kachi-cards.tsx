"use client";

import { Fragment } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { CUSTOMER_STEPS, customerStatusLabel, customerStep } from "@/lib/order-status";
import { press, spring } from "@/lib/motion/tokens";
import type { KachiCard, KachiScope } from "@/lib/kachi-types";

/*
 * What Kachi shows under a reply: changes with Undo, lists to approve,
 * memories, account changes, recipes and order status. Shared by the full
 * chat (/assistant) and the floating bubble.
 */

/** A card as shown: plus whether it was undone, is busy, or is from an earlier visit (a record, not a control). */
export type CardState = KachiCard & { undone?: boolean; done?: string; busy?: boolean; stale?: boolean };

/** **bold** and line breaks from Kachi's plain-text replies, nothing else. */
export function RichText({ text, className = "text-base leading-relaxed" }: { text: string; className?: string }) {
  return (
    <p className={`whitespace-pre-line ${className}`}>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
      )}
    </p>
  );
}

export function KachiCardView({
  card,
  scopeName,
  onUndo,
  onApprove,
  onSkip,
  onSend,
}: {
  card: CardState;
  scopeName: (s: KachiScope) => string;
  onUndo: () => void;
  onApprove: () => void;
  onSkip: () => void;
  onSend: (text: string) => void;
}) {
  const shell = "mt-2.5 overflow-hidden rounded-2xl border border-hairline";

  if (card.type === "recipes") {
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        {card.recipes.map((r, idx) => (
          <div key={r.slug} className={`px-3.5 py-3 ${idx ? "border-t border-hairline" : ""}`}>
            <Link href={`/recipes/${r.slug}`} className="group flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-soft-mist">
                <Icon name="recipes" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold leading-snug group-hover:underline">{r.title}</b>
                <small className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{r.summary}</small>
              </span>
              <Icon name="caretRight" size={16} className="mt-3 flex-none text-muted" />
            </Link>
            {!card.stale && r.fromBasket > 0 && (
              <button
                onClick={() => onSend(`Add the ingredients for ${r.title}`)}
                className="ml-13 mt-2 inline-flex h-8.5 items-center gap-1.5 rounded-full bg-soft-mist px-3 text-[13px] font-semibold active:bg-border"
              >
                <Icon name="plus" size={14} weight="bold" />
                Add the {r.fromBasket} ingredients
              </button>
            )}
          </div>
        ))}
      </motion.div>
    );
  }

  if (card.type === "act") {
    const where = scopeName(card.scope);
    const n = card.changes.length;
    const one = card.changes[0];
    let text: React.ReactNode;
    if (n === 1 && one.after > one.before) {
      text = <>Added <b className="font-semibold">{one.after - one.before} {one.name.toLowerCase()}</b> to {where}.</>;
    } else if (n === 1 && one.after === 0) {
      text = <>Removed <b className="font-semibold">{one.name.toLowerCase()}</b> from {where}.</>;
    } else if (n === 1) {
      text = <>Changed <b className="font-semibold">{one.name.toLowerCase()}</b> to {one.after} in {where}.</>;
    } else if (card.changes.every((c) => c.after > c.before)) {
      text = <>Added <b className="font-semibold">{n} things</b> to {where}.</>;
    } else if (card.changes.every((c) => c.after === 0)) {
      text = <>Removed <b className="font-semibold">{n} things</b> from {where}.</>;
    } else {
      text = <>Changed <b className="font-semibold">{n} things</b> in {where}.</>;
    }
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        <div className={`flex items-center gap-3 px-3.5 py-3 transition-opacity ${card.undone ? "opacity-50" : ""}`}>
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
              card.undone ? "bg-soft-mist text-muted" : "bg-mint-pop/30 text-carbon"
            }`}
          >
            <Icon name="checkPlain" size={16} weight="bold" />
          </span>
          <span className="flex-1 text-[15px] leading-snug">
            {card.undone && "Undone. "}
            {text}
          </span>
          {!card.undone && !card.stale && (
            <button disabled={card.busy} onClick={onUndo} className="p-1.5 text-sm font-semibold text-carbon underline-offset-2 hover:underline disabled:opacity-50">
              Undo
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  if (card.type === "list") {
    const total = card.items.reduce((t, i) => t + i.unitPrice * i.quantity, 0);
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        {card.items.map((i, idx) => (
          <div key={i.productId} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx ? "border-t border-hairline" : ""}`}>
            <ProductImage
              publicId={i.cloudinaryPublicId}
              alt={i.name}
              emoji={i.imageEmoji}
              className="h-10 w-10 flex-none"
              rounded="rounded-[10px]"
              flavour="bg-soft-mist"
              emojiClassName="text-[22px]"
              sizes="40px"
            />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-semibold">{i.name}</b>
              <small className="text-[13px] text-muted">
                {i.quantity} x {i.unit}
              </small>
            </span>
            <span className="text-sm font-semibold">{formatNaira(i.unitPrice * i.quantity)}</span>
          </div>
        ))}
        <div className="flex gap-2 bg-soft-mist px-3.5 py-3">
          {card.done ? (
            <span className="py-3 text-sm font-semibold text-carbon">{card.done}</span>
          ) : card.stale ? (
            <span className="py-3 text-sm text-muted">Suggested list</span>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: press.scale }}
                disabled={card.busy}
                onClick={onApprove}
                className="h-11 flex-1 rounded-full bg-carbon text-[15px] font-semibold text-white disabled:opacity-50"
              >
                Add all, {formatNaira(total)}
              </motion.button>
              <motion.button
                whileTap={{ scale: press.scale }}
                disabled={card.busy}
                onClick={onSkip}
                className="h-11 flex-1 rounded-full bg-surface text-[15px] font-semibold disabled:opacity-50"
              >
                Not now
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  if (card.type === "memory") {
    const remembered = card.action === "remembered";
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        <div className={`flex items-center gap-3 px-3.5 py-3 transition-opacity ${card.undone ? "opacity-50" : ""}`}>
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
              card.undone ? "bg-soft-mist text-muted" : card.memory.kind === "ALLERGY" ? "bg-ember/15 text-ember" : "bg-lavender/40 text-carbon"
            }`}
          >
            <Icon name={card.memory.kind === "ALLERGY" ? "warning" : "spark"} size={16} weight="bold" />
          </span>
          <span className="flex-1 text-[15px] leading-snug">
            {card.undone ? "Undone. " : remembered ? "I'll remember: " : "Forgotten: "}
            <b className="font-semibold">{card.memory.text}</b>
            {!card.undone && (
              <Link href="/account/kachi" className="mt-0.5 block text-[13px] text-muted underline-offset-2 hover:underline">
                See what I know
              </Link>
            )}
          </span>
          {!card.undone && !card.stale && (
            <button disabled={card.busy} onClick={onUndo} className="p-1.5 text-sm font-semibold text-carbon underline-offset-2 hover:underline disabled:opacity-50">
              Undo
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  if (card.type === "account") {
    const c = card.change;
    const day = (d: string) => d.charAt(0) + d.slice(1).toLowerCase();
    const text: React.ReactNode =
      c.kind === "skip" ? (
        <>
          {c.skipped ? "Skipped" : "Brought back"} <b className="font-semibold">{new Date(c.dateIso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}</b>
          {c.skipped ? ". Nothing comes that week." : "."}
        </>
      ) : c.kind === "day" ? (
        <>
          Your basket now comes on <b className="font-semibold">{day(c.to)}</b>, not {day(c.from)}.
        </>
      ) : c.kind === "repeat" ? (
        c.on ? (
          <>
            Your basket <b className="font-semibold">comes every week</b> again.
          </>
        ) : (
          <>
            Your basket is <b className="font-semibold">paused</b>. It keeps its produce until you start it again.
          </>
        )
      ) : c.kind === "rename" ? (
        c.to ? (
          <>
            Your basket is now called <b className="font-semibold">{c.to}</b>.
          </>
        ) : (
          <>Your basket&apos;s name is cleared.</>
        )
      ) : (
        <>
          Reported: <b className="font-semibold">{c.label}</b>. The team will get back to you.
        </>
      );
    const report = c.kind === "report";
    return (
      <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
        <div className={`flex items-center gap-3 px-3.5 py-3 transition-opacity ${card.undone ? "opacity-50" : ""}`}>
          <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${card.undone ? "bg-soft-mist text-muted" : report ? "bg-sky-wash text-carbon" : "bg-mint-pop/30 text-carbon"}`}>
            <Icon name={report ? "send" : c.kind === "skip" || c.kind === "day" ? "calendar" : "checkPlain"} size={16} weight="bold" />
          </span>
          <span className="flex-1 text-[15px] leading-snug">
            {card.undone && "Undone. "}
            {text}
            {report && (
              <Link href={`/orders/${c.orderId}`} className="mt-0.5 block text-[13px] text-muted underline-offset-2 hover:underline">
                See the order
              </Link>
            )}
          </span>
          {!report && !card.undone && !card.stale && (
            <button disabled={card.busy} onClick={onUndo} className="p-1.5 text-sm font-semibold text-carbon underline-offset-2 hover:underline disabled:opacity-50">
              Undo
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Only in chats from before Kachi had one mode: a record, not a control.
  if (card.type === "ask") return null;

  const step = customerStep(card.order.status) ?? -1;
  const day = new Date(card.order.deliveryDate).toLocaleDateString("en-GB", { weekday: "long" });
  return (
    <motion.div layout className={shell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
      <div className="p-3.5">
        <h4 className="text-[15px] font-semibold">
          {card.order.status === "DELIVERED" ? `Delivered ${day}` : step < 0 || card.order.status === "FAILED_DELIVERY" ? customerStatusLabel(card.order.status) : `Arriving ${day}`}
        </h4>
        <small className="text-[13px] text-muted">Order #{card.order.id.slice(-8).toUpperCase()}</small>
        <div className="mt-3 flex gap-1.5">
          {CUSTOMER_STEPS.map((s, i) => (
            <motion.i
              key={s}
              className={`block h-1.5 flex-1 rounded-full ${i <= step ? "bg-carbon" : "bg-soft-mist"}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ originX: 0 }}
              transition={{ ...spring.smooth, delay: i * 0.06 }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          {CUSTOMER_STEPS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

