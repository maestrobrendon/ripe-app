"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import type { StreakView } from "@/lib/streak-config";
import { IdeasDesktopPanel } from "./ideas-desktop-panel";
import { IdeasSheetTrigger } from "./ideas-sheet-trigger";
import {
  setBasketItemQuantity,
  setWindowSkipped,
  swapBasketItem,
  restoreLastWeek,
  copyBasketToCart,
} from "./actions";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RollingNumber } from "@/components/ui/rolling-number";
import { press, spring, stagger } from "@/lib/motion/tokens";

export type BasketLine = {
  productId: string;
  name: string;
  unit: string;
  inSeason: boolean;
  stepQty: number;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  memberPrice: number;
  standardPrice: number;
  quantity: number;
};

export type QuickAddItem = {
  id: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  minOrderQty: number;
};

export type Flagged = {
  productId: string;
  reason: string;
  swapToId: string;
  swapToName: string;
  swapToEmoji: string;
};

export function BasketWorkspace({
  basketId,
  basketName,
  items,
  isMemberPriced,
  isFreeTrial,
  trialDelivered,
  locked,
  skipped,
  streak,
  savings,
  goalFit,
  quickAdd,
  flagged,
  canRestore,
  signature,
}: {
  basketId: string;
  basketName: string;
  items: BasketLine[];
  /** Whether this specific basket is priced at member rates, locked at creation. */
  isMemberPriced: boolean;
  isFreeTrial: boolean;
  trialDelivered: boolean;
  locked: boolean;
  skipped: boolean;
  streak: StreakView;
  savings: number;
  goalFit: string | null;
  quickAdd: QuickAddItem[];
  flagged: Flagged[];
  canRestore: boolean;
  signature: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const editable = !locked && !skipped && !trialDelivered;
  const flaggedMap = new Map(flagged.map((f) => [f.productId, f]));
  const priceOf = (l: BasketLine) => (isMemberPriced ? l.memberPrice : l.standardPrice);

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector<HTMLInputElement>('input[aria-label="Search produce"]')?.focus();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* min-w-0 overrides the grid item's default min-width:auto. Without
          it, the horizontally-scrolling quick-add row below (overflow-x-auto)
          can't shrink the whole column below its own content's natural
          width, so the column renders wider than the phone's viewport
          instead of scrolling internally. */}
      <div className="min-w-0">
        {/* The window lock is a subscriber-basket mechanic; a free-trial basket
            never auto-recurs, so there is nothing here to skip. */}
        {!isFreeTrial && !trialDelivered && (
          <div className="mb-3 flex justify-end">
            <motion.button
              disabled={isPending || locked}
              onClick={() => run(() => setWindowSkipped(basketId, !skipped))}
              whileTap={{ scale: press.scale }}
              transition={spring.snappy}
              className={`tap-target rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                skipped ? "border-border bg-ember/12 text-carbon" : "border-border hover:bg-sky-wash"
              }`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={skipped ? "skipped" : "skip"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring.snappy}
                  className="inline-block"
                >
                  {skipped ? "Skipped. Undo" : "Skip this week"}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        )}

        {/* Same as last week: the "Often added" rail further down already
            covers one-tap adding, so there is no separate quick-add shelf
            here. */}
        {editable && canRestore && (
          <div className="mb-4">
            <button
              disabled={isPending}
              onClick={() => run(() => restoreLastWeek(basketId))}
              className="tap-target rounded-full bg-carbon px-4 py-2 text-sm font-medium text-white hover:bg-carbon/85 disabled:opacity-60"
            >
              Same as last time
            </button>
          </div>
        )}

        {/* Item count heading + Get ideas, or "What was inside" for a delivered trial */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            {trialDelivered
              ? "What was inside"
              : items.length > 0
              ? `${items.length} item${items.length > 1 ? "s" : ""}`
              : "Nothing here yet"}
          </h2>
          {!trialDelivered && (
            <IdeasSheetTrigger
              basketId={basketId}
              signature={signature}
              locked={!editable}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-carbon"
              icon="spark"
              label="Get ideas"
            />
          )}
        </div>

        {items.length === 0 && !trialDelivered ? (
          <p className="mt-3 rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
            Tap + on anything below to add it.
          </p>
        ) : (
          <motion.ul
            animate={skipped ? { opacity: 0.5, scale: 0.98 } : { opacity: 1, scale: 1 }}
            transition={spring.smooth}
            className={`mt-3 divide-y divide-border ${trialDelivered ? "opacity-45 grayscale" : ""}`}
          >
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const flag = flaggedMap.get(item.productId);
                const unitLine = `${item.unit}${!trialDelivered ? ` · ${formatNaira(priceOf(item))}${isMemberPriced ? " member" : ""}` : ""}`;
                return (
                  <motion.li
                    key={item.productId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring.smooth}
                    className="py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ProductImage
                        publicId={item.cloudinaryPublicId}
                        alt={item.name}
                        emoji={item.imageEmoji}
                        className="h-13 w-13 shrink-0"
                        rounded="rounded-xl"
                        emojiClassName="text-2xl"
                        sizes="52px"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="text-sm text-muted">{unitLine}</p>
                      </div>
                      {trialDelivered ? (
                        <span className="shrink-0 text-sm text-muted">x{item.quantity}</span>
                      ) : (
                        <>
                          <QuantityStepper
                            variant="inline"
                            alwaysStepper
                            quantity={item.quantity}
                            min={item.stepQty}
                            step={item.stepQty}
                            label={item.name}
                            disabled={isPending || !editable}
                            onChange={(next) => run(() => setBasketItemQuantity(basketId, item.productId, next))}
                          />
                          <p className="w-16 shrink-0 text-right text-sm font-medium">
                            <RollingNumber value={priceOf(item) * item.quantity} format={formatNaira} />
                          </p>
                        </>
                      )}
                    </div>

                    {flag && editable && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 flex flex-wrap items-center gap-2 rounded-input border border-border bg-ember/12 p-2 text-xs"
                      >
                        <span className="text-carbon">{flag.reason}.</span>
                        <button
                          disabled={isPending}
                          onClick={() => run(() => swapBasketItem(basketId, flag.productId, flag.swapToId))}
                          className="rounded-full border border-carbon px-3 py-1 font-medium text-carbon hover:bg-sky-wash disabled:opacity-60"
                        >
                          Swap for {flag.swapToEmoji} {flag.swapToName}
                        </button>
                      </motion.div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}

        {!trialDelivered && (
          <button
            onClick={focusSearch}
            className="flex w-full items-center gap-3 border-t border-border py-3 text-left text-sm text-muted"
          >
            <span className="flex h-13 w-13 items-center justify-center rounded-xl border border-dashed border-border text-lg">
              +
            </span>
            Search to add more
          </button>
        )}

        {isMemberPriced && goalFit && !trialDelivered && (
          <p className="mt-3 inline-flex w-fit rounded-full bg-sky-wash px-3 py-1 text-xs font-medium text-carbon">
            {goalFit}
          </p>
        )}

        {trialDelivered ? (
          <div className="mt-5 rounded-2xl bg-lavender p-4">
            <h3 className="text-lg font-semibold text-carbon">Want this every week?</h3>
            <p className="mt-1.5 text-[15px] leading-snug text-carbon/80">
              Members get this basket brought to them on the same day, every week. No need to order again.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <Link
                href="/subscribe"
                className="tap-target rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white"
              >
                Become a member
              </Link>
              <button
                disabled={isPending}
                onClick={() => run(() => copyBasketToCart(basketId))}
                className="tap-target rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-carbon disabled:opacity-60"
              >
                Buy these once
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <h2 className="text-sm font-semibold">Often added</h2>
              <p className="text-xs text-muted">Tap + to put it in {basketName}</p>
              {quickAdd.length > 0 ? (
                <div
                  className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
                  style={{
                    maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
                  }}
                >
                  {quickAdd.map((q, i) => {
                    const inBasket = items.some((it) => it.productId === q.id);
                    return (
                      <motion.div
                        key={q.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring.snappy, delay: Math.min(i, 8) * stagger.tight }}
                        className="w-[124px] shrink-0"
                      >
                        <div className="relative">
                          <ProductImage
                            publicId={q.cloudinaryPublicId}
                            alt={q.name}
                            emoji={q.imageEmoji}
                            className="h-[104px] w-full"
                            rounded="rounded-2xl"
                            emojiClassName="text-4xl"
                            sizes="124px"
                          />
                          <motion.button
                            type="button"
                            disabled={isPending || !editable}
                            aria-label={inBasket ? `${q.name} is in ${basketName}` : `Add ${q.name} to ${basketName}`}
                            onClick={() => run(() => setBasketItemQuantity(basketId, q.id, q.minOrderQty))}
                            whileTap={{ scale: press.scale }}
                            transition={spring.snappy}
                            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-carbon text-white shadow-sm disabled:opacity-60"
                          >
                            <Icon name={inBasket ? "checkPlain" : "plus"} size={16} weight="bold" />
                          </motion.button>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold">{q.name}</p>
                      </motion.div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {!isMemberPriced && savings > 0 && (
              <Link
                href="/subscribe"
                className="mt-5 flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-sm"
              >
                <p className="flex-1 text-muted">
                  Members would pay <b className="font-semibold text-foreground">{formatNaira(
                    items.reduce((sum, i) => sum + i.memberPrice * i.quantity, 0),
                  )}</b> for this. That is {formatNaira(savings)} less.
                </p>
                <Icon name="caretDown" size={16} className="-rotate-90 shrink-0 text-muted" />
              </Link>
            )}
          </>
        )}
      </div>

      <IdeasDesktopPanel
        basketId={basketId}
        signature={signature}
        locked={!editable}
        streak={streak}
        showStreak={isMemberPriced}
      />
    </div>
  );
}
