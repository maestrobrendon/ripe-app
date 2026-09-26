"use client";

import { useMemo, useState } from "react";
import { buildStarterPicks, type StarterCandidate } from "@/lib/starter-basket-core";
import { ProductImage } from "@/components/product-image";
import { LinkButton } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import { Icon } from "@/components/ui/icon";

const DAY_LIST = SHOPPING_WINDOW_DAYS.map((d) => d.label).join(", ");

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="tap-target flex h-9 w-9 items-center justify-center rounded-full border border-border text-lg leading-none disabled:opacity-30"
        >
          <Icon name="minus" size={16} />
        </button>
        <span className="w-8 text-center text-base font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(12, value + 1))}
          aria-label={`More ${label.toLowerCase()}`}
          className="tap-target flex h-9 w-9 items-center justify-center rounded-full border border-border text-lg leading-none"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Hero estimator: builds a real starter basket from the live catalogue and
 * prices it both ways, so the standard/member toggle shows an actual saving
 * rather than a marketing claim.
 */
export function BasketEstimator({ candidates }: { candidates: StarterCandidate[] }) {
  const [isMember, setIsMember] = useState(false);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);

  const picks = useMemo(
    () =>
      buildStarterPicks(
        { goalSlug: null, producePreferences: [], adults, kids },
        candidates,
      ),
    [adults, kids, candidates],
  );

  const standardTotal = picks.reduce((sum, p) => sum + p.standardPrice * p.quantity, 0);
  const memberTotal = picks.reduce((sum, p) => sum + p.memberPrice * p.quantity, 0);
  const subtotal = isMember ? memberTotal : standardTotal;
  const delivery = quoteDelivery(subtotal, isMember);
  const saving = standardTotal - memberTotal;
  const itemCount = picks.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="overflow-hidden rounded-card-lg border border-border bg-surface">
      {/* Segmented control: the two ways to pay for the same basket */}
      <div className="p-4 sm:p-5">
        <div className="flex rounded-full bg-sky-wash p-1">
          {[
            { label: "One-off order", member: false },
            { label: "Member price", member: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setIsMember(opt.member)}
              aria-pressed={isMember === opt.member}
              className={`tap-target flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isMember === opt.member
                  ? "bg-carbon text-white"
                  : "text-carbon hover:bg-white/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border border-t border-border">
        {/* Input: who is eating */}
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Shopping for
          </p>
          <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
          <Stepper label="Kids" value={kids} min={0} onChange={setKids} />
        </div>

        {/* Output: the basket that produces */}
        <div className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                A week of produce
              </p>
              <p className="mt-1 text-sm text-muted">
                {picks.length} kinds, {itemCount} items
              </p>
            </div>
            <p className="text-heading shrink-0">{formatNaira(subtotal)}</p>
          </div>

          {picks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {picks.slice(0, 6).map((p) => (
                <ProductImage
                  key={p.productId}
                  publicId={p.cloudinaryPublicId}
                  alt={p.name}
                  emoji={p.imageEmoji}
                  className="h-11 w-11"
                  rounded="rounded-full"
                  emojiClassName="text-lg"
                  sizes="44px"
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer rows: the fee and timing detail */}
        <div className="space-y-2 p-4 text-sm sm:p-5">
          <div className="flex justify-between">
            <span className="text-muted">Delivery</span>
            <span className="font-medium">
              {delivery.isFree ? "Free" : formatNaira(delivery.fee)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Ships</span>
            <span className="font-medium">{DAY_LIST}</span>
          </div>
          {isMember ? (
            saving > 0 && (
              <div className="flex justify-between text-carbon">
                <span>You save vs one-off</span>
                <span className="font-semibold">{formatNaira(saving)}</span>
              </div>
            )
          ) : (
            <p className="text-xs text-muted">
              Members pay {formatNaira(memberTotal)} for the same basket, with delivery included.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border p-4 sm:p-5">
        <LinkButton href="/start" size="lg" className="w-full">
          Build my basket
        </LinkButton>
        <p className="mt-3 text-center text-xs text-muted">
          Free to set up. Nothing is charged until you check out yourself.
        </p>
      </div>
    </div>
  );
}
