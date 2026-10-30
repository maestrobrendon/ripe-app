/**
 * BASKET · BRAND FONTS
 * ---------------------------------------------------------------------------
 * Display: stands in for Ozik — hero/section headlines only (56/80px, caps).
 * UI/body: stands in for Aeonik — everything else.
 *
 * Dr Kabel is a locally installed single-weight display face (self-hosted,
 * not Google Fonts); Inter is the spec's own first fallback for Aeonik.
 */
import { Inter } from "next/font/google";
import localFont from "next/font/local";

export const displayFont = localFont({
  src: "../fonts/DrKabel.otf",
  variable: "--font-dr-kabel",
  weight: "400",
  display: "swap",
});

export const textFont = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Inter's ₦ on its own (1 KB, every weight). Google files ₦ under latin-ext,
 * so without this every price on the site downloaded that whole 84 KB file
 * for one glyph. Listed before Inter in the font stacks (globals.css); its
 * unicode-range means it's only fetched on pages that show a price. Cut from
 * Inter's latin-ext file with: pyftsubset <file> --unicodes=U+20A6 --flavor=woff2
 */
export const nairaFont = localFont({
  src: "../fonts/InterNaira.woff2",
  variable: "--font-naira",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20A6" }],
});

/** Put on <html>. */
export const fontVariables = `${displayFont.variable} ${textFont.variable} ${nairaFont.variable}`;
