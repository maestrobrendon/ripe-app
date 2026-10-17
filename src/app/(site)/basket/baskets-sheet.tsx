"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { createBasket } from "./actions";

export type SheetBasket = {
  id: string;
  name: string;
  subtitle: string;
  locked?: boolean;
};

/**
 * The sheet opened from tapping the basket name in the hero. Members start
 * another basket from here, up to their plan's limit (three on Member, none on
 * Member Plus); at the limit, or on the one free trial basket, "New basket"
 * routes to Pricing instead.
 */
export function BasketsSheet({
  open,
  onClose,
  baskets,
  activeId,
  isSubscriber,
  basketLimit,
}: {
  open: boolean;
  onClose: () => void;
  baskets: SheetBasket[];
  activeId: string;
  isSubscriber: boolean;
  basketLimit: number | null;
}) {
  const atLimit = basketLimit !== null && baskets.length >= basketLimit;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <BottomSheet open={open} onClose={onClose} title="Your baskets">
      <p className="mb-3 text-sm text-muted">
        {!isSubscriber
          ? "Free accounts get one trial basket."
          : basketLimit === null
            ? "Each basket comes on its own day, every week. No limit on Member Plus."
            : `Each basket comes on its own day, every week. ${baskets.length} of ${basketLimit} on Member.`}
      </p>

      <div className="space-y-2">
        {baskets.map((b) => (
          <button
            key={b.id}
            disabled={isPending}
            onClick={() => {
              onClose();
              if (b.id !== activeId) {
                startTransition(() => {
                  router.push(`/basket?b=${b.id}`);
                });
              }
            }}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
              b.locked ? "opacity-55" : ""
            } ${b.id === activeId ? "border-carbon" : "border-border hover:bg-sky-wash"}`}
          >
            <span className="min-w-0 flex-1">
              <b className="block text-base font-semibold">{b.name}</b>
              <small className="mt-0.5 block text-sm text-muted">{b.subtitle}</small>
            </span>
            {b.id === activeId && <Icon name="check" size={20} className="shrink-0 text-carbon" />}
          </button>
        ))}

        {isSubscriber && !atLimit ? (
          <button
            disabled={isPending}
            onClick={() => startTransition(() => createBasket())}
            className="flex w-full items-center gap-3 rounded-2xl border border-border p-4 text-left hover:bg-sky-wash disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
              <Icon name="plus" size={18} />
            </span>
            <span>
              <b className="block text-base font-semibold">New basket</b>
              <small className="block text-sm text-muted">Pick a name and a day</small>
            </span>
          </button>
        ) : (
          <Link
            href={isSubscriber ? "/subscribe?reason=basket-limit" : "/subscribe?reason=free-basket-used"}
            onClick={onClose}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left"
          >
            <span>
              <b className="block text-base font-semibold text-muted">New basket</b>
              <small className="block text-sm text-muted">
                {isSubscriber ? "Member Plus has no basket limit" : "Available with a membership"}
              </small>
            </span>
          </Link>
        )}
      </div>
    </BottomSheet>
  );
}
