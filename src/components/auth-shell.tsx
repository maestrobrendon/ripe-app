import Image from "next/image";
import type { ReactNode } from "react";

/*
 * The frame for sign-in and password pages: the form on the left, a photo of
 * the produce arriving on the right (on phones, a short strip above the form).
 * The photo panel says what Basket is, so the form can stay short.
 */

/** Text inputs on the auth pages share this look (see PasswordField too). */
export const authInput =
  "h-12 w-full rounded-xl border border-border bg-paper-white px-4 text-[15px] outline-none transition-shadow placeholder:text-carbon/35 focus:border-carbon focus:shadow-[0_0_0_3px_rgb(0_0_0/0.08)]";

export const authPrimaryButton =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-carbon px-6 text-[15px] font-semibold text-paper-white transition-colors hover:bg-carbon/85";

export const authSecondaryButton =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-paper-white px-6 text-[15px] font-semibold text-carbon transition-colors hover:bg-soft-mist/60";

const PHOTOS = {
  doorstep: { src: "/images/home/fresh-doorstep.jpg", alt: "A rider hands a basket of fresh fruit and vegetables to a woman at her front door" },
  kitchen: { src: "/images/home/fresh-kitchen.jpg", alt: "Pineapple, mangoes, bananas and greens being unpacked on a kitchen counter" },
} as const;

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-6 flex gap-2.5 rounded-xl bg-ember/10 px-4 py-3 text-sm leading-relaxed text-[#8a2a00]">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6.5v4M10 13.5v.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function AuthShell({
  title,
  subtitle,
  photo = "doorstep",
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  photo?: keyof typeof PHOTOS;
  children: ReactNode;
}) {
  const p = PHOTOS[photo];
  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:py-12">
      <div className="flex flex-col justify-center">
        {/* Phones get the photo as a short strip, so the form stays near the top. */}
        <div className="relative mb-8 h-36 overflow-hidden rounded-[24px] bg-soft-mist sm:h-44 lg:hidden">
          <Image src={p.src} alt="" fill sizes="100vw" className="object-cover" priority />
        </div>

        <div className="mx-auto w-full max-w-[400px] lg:py-10">
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-carbon/60">{subtitle}</p>}
          {children}
        </div>
      </div>

      <aside className="relative hidden min-h-[640px] overflow-hidden rounded-[32px] bg-soft-mist lg:block">
        <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 640px, 0px" className="object-cover" priority />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0)_45%,rgb(0_0_0/0.72)_100%)]" aria-hidden />
        <span className="absolute top-5 left-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-paper-white/92 px-3.5 text-[13px] font-semibold text-carbon backdrop-blur-sm">
          <span className="text-[#0f7a48]">
            <Tick />
          </span>
          Delivered on your day
        </span>
        <div className="absolute inset-x-0 bottom-0 p-8 text-paper-white">
          <p className="max-w-[24ch] text-[28px] leading-[1.15] font-semibold tracking-[-0.025em]">Your week of meals and fruit, planned and delivered.</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {["Fresh produce, checked by hand", "Recipes for your goal", "Change it until the night before"].map((t) => (
              <li key={t} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-paper-white/14 px-3 text-[13px] font-medium backdrop-blur-sm">
                <Tick />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
