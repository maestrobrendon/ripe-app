import { formatNaira } from "@/lib/format";
import { GIFT_DESIGNS } from "@/lib/gift-config";

/**
 * The gift as a card: its colour, a ribbon, the value, who it's from and
 * their note. Shared by the send flow's preview and the page the recipient opens.
 */
export function GiftCard({
  design,
  amount,
  to,
  from,
  message,
  className = "",
}: {
  design: string;
  amount: number;
  to: string;
  from: string;
  message: string | null;
  className?: string;
}) {
  const d = GIFT_DESIGNS.find((x) => x.id === design) ?? GIFT_DESIGNS[0];
  return (
    <div className={`relative aspect-[1.6/1] w-full overflow-hidden rounded-[26px] p-6 text-left shadow-[0_24px_48px_-28px_rgb(0_0_0/0.45)] ${className}`} style={{ backgroundColor: d.bg, color: d.ink }}>
      {/* The ribbon, across and down, with a bow where they cross. */}
      <span className="absolute inset-y-0 right-[22%] w-5" style={{ backgroundColor: d.ribbon, opacity: 0.9 }} aria-hidden />
      <span className="absolute inset-x-0 top-[38%] h-5" style={{ backgroundColor: d.ribbon, opacity: 0.9 }} aria-hidden />
      <span className="absolute top-[38%] right-[22%] -translate-y-[38%] translate-x-[30%] text-[44px] leading-none" aria-hidden>
        🎀
      </span>
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <p className="logo-wordmark text-[18px] leading-none">BasketNG</p>
          <p className="mt-1 text-[12px] font-semibold tracking-[0.08em] uppercase opacity-70">A basket for {to || "someone special"}</p>
        </div>
        <div>
          <p className="text-[clamp(1.9rem,8vw,2.6rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">{formatNaira(amount)}</p>
          <p className="mt-1.5 line-clamp-2 max-w-[70%] text-[13px] leading-snug opacity-80">{message ? `“${message}”` : "Fresh fruit and veg, delivered."}</p>
          <p className="mt-1 text-[12px] font-semibold opacity-70">From {from || "you"}</p>
        </div>
      </div>
    </div>
  );
}
