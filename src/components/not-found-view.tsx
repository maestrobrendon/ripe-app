import Link from "next/link";
import { AvocadoHalf, Carrot, Chilli, LimeSlice, Sparkle, Tomato, INK } from "@/app/(bare)/home-menu/parts/art";

/**
 * The 404, wherever it's shown: "4 🥑 4" with the zero drawn as a half
 * avocado that rocks gently, a little produce drifting around it, one line
 * that says what happened, and the three places most people meant to go.
 * Plain HTML and CSS (the .nf-* animations in globals.css), so it renders
 * the same from the global 404, which skips the app's layouts and scripts.
 * `inLayout`: inside the site's header and tab bar, so it needn't fill the screen.
 */
export function NotFoundView({ inLayout = false }: { inLayout?: boolean }) {
  return (
    <main className={`relative flex ${inLayout ? "min-h-[75svh]" : "min-h-svh"} flex-col items-center justify-center overflow-hidden bg-paper-white px-4 py-16 text-center text-carbon`}>
      {/* Produce drifting at the edges, out of the way of the words. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Tomato className="nf-float absolute top-[9%] left-[7%] w-[13vw] max-w-[88px] min-w-[52px]" style={{ animationDelay: "0s" }} />
        <LimeSlice className="nf-float absolute top-[14%] right-[9%] w-[11vw] max-w-[72px] min-w-[44px]" style={{ animationDelay: "-2s" }} />
        <Chilli className="nf-float absolute bottom-[12%] left-[10%] w-[12vw] max-w-[80px] min-w-[48px] rotate-[-18deg]" style={{ animationDelay: "-4s" }} />
        <Carrot className="nf-float absolute right-[8%] bottom-[16%] w-[12vw] max-w-[84px] min-w-[48px] rotate-[24deg]" style={{ animationDelay: "-1s" }} />
        <Sparkle color={INK.sun} className="nf-twinkle absolute top-[30%] left-[22%] w-6" />
        <Sparkle color={INK.mint} className="nf-twinkle absolute top-[24%] right-[26%] w-4" style={{ animationDelay: "-1.2s" }} />
      </div>

      <p className="relative text-[13px] font-semibold tracking-[0.12em] text-[#0f7a48] uppercase">Error 404</p>

      <h1 className="relative mt-4 flex items-center justify-center gap-[0.06em] text-[clamp(6rem,26vw,11rem)] leading-none" aria-label="404">
        <span className="font-[family-name:var(--font-dr-kabel)] tracking-[-0.02em]" aria-hidden>
          4
        </span>
        <AvocadoHalf aria-hidden className="nf-rock h-[0.86em] w-[0.86em] drop-shadow-[0_18px_22px_rgb(0_0_0/0.12)]" />
        <span className="font-[family-name:var(--font-dr-kabel)] tracking-[-0.02em]" aria-hidden>
          4
        </span>
      </h1>

      <h2 className="relative mt-6 text-[clamp(1.8rem,6vw,2.6rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance">This page has gone off.</h2>
      <p className="relative mx-auto mt-3 max-w-[26rem] text-[17px] leading-snug text-carbon/65">
        It may have moved, or the link has a typo. The fresh stuff is this way.
      </p>

      <nav className="relative mt-9 grid w-full max-w-[22rem] gap-2.5" aria-label="Where to go">
        <Link href="/" className="flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white transition-transform active:scale-[0.98]">
          Go home
        </Link>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/shop" className="flex h-12 items-center justify-center rounded-full bg-[#f3f5f0] text-[15px] font-semibold transition-colors hover:bg-[#e8ede3]">
            Fruit &amp; veg
          </Link>
          <Link href="/recipes" className="flex h-12 items-center justify-center rounded-full bg-[#f3f5f0] text-[15px] font-semibold transition-colors hover:bg-[#e8ede3]">
            Recipes
          </Link>
        </div>
      </nav>

      <p className="relative mt-7 text-[14px] text-carbon/55">
        Looking for something in particular?{" "}
        <Link href="/faq" className="font-semibold text-carbon underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
          See the questions
        </Link>
      </p>
    </main>
  );
}
