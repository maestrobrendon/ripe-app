"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { haptic } from "@/lib/haptics";
import { chooseAddTarget, listAddTargets, startOneOff, type AddTarget } from "@/app/(site)/basket/actions";

/*
 * Where the shop adds things, chosen in one place: a sheet listing the
 * customer's baskets and their one-time order. Whatever is picked becomes the
 * basket Home, the shop, recipes and Kachi all add to, until changed again.
 * Opened from the split "Add to …" button on a product, and the "Adding to"
 * chip on the shop.
 */

type Loaded = { activeId: string | null; targets: AddTarget[]; member: boolean };

export function AddTargetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [pending, start] = useTransition();
  const [going, setGoing] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void listAddTargets().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [open]);

  const pick = (id: string | "one-off", label: string) => {
    if (id === data?.activeId) return onClose();
    haptic("selection");
    setGoing(id);
    start(async () => {
      const r = id === "one-off" ? await startOneOff() : await chooseAddTarget(id);
      setGoing(null);
      if (!r.ok) return cart.announce(r.error, "error");
      await cart.refresh();
      router.refresh();
      onClose();
      cart.announce(`Adding to ${label}`);
    });
  };

  const hasOneOff = data?.targets.some((t) => t.oneOff);

  return (
    <BottomSheet open={open} onClose={onClose} title="Add to" desktopDialog>
      {!data ? (
        <div className="grid gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-soft-mist" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {data.targets.map((t) => (
            <Row
              key={t.id}
              on={t.id === data.activeId}
              busy={pending && going === t.id}
              icon={t.oneOff ? "box" : "parcel"}
              title={t.label}
              sub={`${t.sub} · ${t.itemCount} ${t.itemCount === 1 ? "item" : "items"}`}
              onClick={() => pick(t.id, t.label)}
            />
          ))}
          {data.member && !hasOneOff && (
            <Row
              on={false}
              busy={pending && going === "one-off"}
              icon="box"
              title="One-time order"
              sub="Delivered once, on any delivery day. Your baskets aren't touched."
              onClick={() => pick("one-off", "your one-time order")}
            />
          )}
          {!data.member && (
            <Link href="/subscribe" className="mt-1 rounded-2xl bg-soft-mist px-4 py-3 text-sm">
              Members can run several baskets and one-time orders. <b className="font-semibold underline underline-offset-2">See membership</b>
            </Link>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function Row({ on, busy, icon, title, sub, onClick }: { on: boolean; busy: boolean; icon: "box" | "parcel"; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-[background-color,border-color,transform] active:scale-[0.99] ${on ? "border-carbon bg-mint-pop/15" : "border-hairline bg-surface"}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold">{title}</b>
        <small className="block truncate text-[13px] text-muted">{sub}</small>
      </span>
      {busy ? <Icon name="spinner" size={18} className="shrink-0 animate-spin" /> : on ? <Icon name="checkPlain" size={18} weight="bold" className="shrink-0" /> : null}
    </button>
  );
}

/** "Adding to Vegan ⌄", at the top of the shop: change where product cards add in one tap. */
export function AddTargetChip() {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  if (cart.container !== "delivery") return null;
  const where = cart.deliveryLabel ?? "your basket";
  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic("selection");
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-soft-mist px-3.5 text-[14px] transition-transform active:scale-[0.97]"
      >
        <span className="text-muted">Adding to</span>
        <b className="max-w-[12rem] truncate font-semibold">{where}</b>
        <Icon name="caretDown" size={14} weight="bold" />
      </button>
      <AddTargetSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
