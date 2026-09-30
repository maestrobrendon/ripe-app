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

/** Put on <html>. */
export const fontVariables = `${displayFont.variable} ${textFont.variable}`;
