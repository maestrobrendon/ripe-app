"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";
import { applyKachiDraft, dismissKachiDraft, undoKachiDraft } from "./actions";

export type DraftLine = {
  productId: string;
  name: string;
  emoji: string;
  publicId: string | null;
  before: number;
  after: number;
  why: string;
};

export type HomeDraft = {
  id: string;
  /** "PENDING" waits for an answer; "ACCEPTED" was just used and can be undone. */
  status: "PENDING" | "ACCEPTED";
  note: string;
  day: string;
  lines: DraftLine[];
  /** What her changes do to the basket's total, in naira (negative when it goes down). */
  difference: number;
  recipe: { slug: string; title: string } | null;
};

/**
 * Kachi's suggestion for this week's basket, on Home. One tap uses it (the
 * customer still confirms and pays), one tap keeps the basket as it is.
 * After using it, the card says so and offers Undo.
 */
export function KachiDraftCard({ draft }: { draft: HomeDraft }) {
  const cart = useCart();
  const router = useRouter();
  const [pending, start] = useTransition();
  // Answers at once on the tap; Home's refresh behind it confirms (the page keys this card on the stored status).
  const [status, setStatus] = useState<"PENDING" | "ACCEPTED" | "DISMISSED">(draft.status);
  const used = status === "ACCEPTED";

  const act = (fn: () => Promise<{ ok: boolean; error?: string; skipped?: string[] }>, next: typeof status, said: string) =>
    start(async () => {
      // Keeping the basket can't go wrong, so the card goes at once (and comes back if saving fails).
      const was = status;
      if (next === "DISMISSED") setStatus(next);
      const r = await fn();
      if (!r.ok) {
        setStatus(was);
        cart.announce(r.error ?? "That didn't work. Try again.", "error");
        return;
      }
      setStatus(next);
      cart.announce(r.skipped?.length ? `${said} ${r.skipped.join(" ")}` : said);
      void cart.refresh();
      router.refresh();
    });

  if (status === "DISMISSED") return null;

  return (
    <section
      aria-label="Kachi's suggestion"
      className="mt-4 overflow-hidden rounded-[22px] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.18)] ring-1 ring-black/[0.06]"
    >
      <div className="px-5 pt-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-lavender">
            <Icon name="spark" size={11} weight="bold" />
          </span>
          {used ? "Done" : `Kachi's suggestion for ${draft.day}`}
        </p>
        <p className="mt-2 text-[17px] leading-snug">{used ? "I've updated your basket. Confirm it below when you're ready." : draft.note}</p>
      </div>

      {!used && (
        <ul className="mt-4 divide-y divide-black/[0.06] border-t border-black/[0.06]">
          {draft.lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-3 px-5 py-3">
              <ProductImage publicId={l.publicId} alt="" emoji={l.emoji} sizes="40px" rounded="rounded-full" className="size-10 shrink-0" emojiClassName="text-xl" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] font-medium ${l.after === 0 ? "text-muted line-through" : ""}`}>
                  {l.after === 0 ? l.name : l.before === 0 ? `Add ${l.after} ${l.name.toLowerCase()}` : `${l.name}: ${l.before} → ${l.after}`}
                </span>
                <span className="block truncate text-[13px] text-muted">{l.why}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!used && draft.recipe && (
        <Link href={`/recipes/${draft.recipe.slug}`} className="flex items-center gap-3 border-t border-black/[0.06] px-5 py-3 transition-colors hover:bg-black/[0.02]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-mist">
            <Icon name="recipes" size={18} />
          </span>
          <span className="min-w-0 flex-1 text-[15px]">
            <span className="block text-[13px] text-muted">Cook it as</span>
            <span className="block truncate font-medium">{draft.recipe.title}</span>
          </span>
          <Icon name="caretRight" size={16} weight="bold" className="shrink-0 text-carbon/30" />
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.06] px-5 py-3.5">
        {used ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => undoKachiDraft(draft.id), "PENDING", "Your basket is back as it was.")}
            className="-ml-2 rounded-full px-2 py-1.5 text-[15px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
          >
            Undo
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => applyKachiDraft(draft.id), "ACCEPTED", "Done. Your basket is updated.")}
              className="inline-flex h-10 items-center rounded-full bg-carbon px-4 text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              Use these changes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => dismissKachiDraft(draft.id), "DISMISSED", "Kept as it is.")}
              className="rounded-full px-3 py-2 text-[15px] font-medium text-carbon/70 transition-colors hover:bg-black/[0.04] disabled:opacity-50"
            >
              Keep my basket
            </button>
            {draft.difference !== 0 && (
              <span className="ml-auto text-[13px] text-muted">
                {draft.difference > 0 ? "+" : "−"}
                {formatNaira(Math.abs(draft.difference))}
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
