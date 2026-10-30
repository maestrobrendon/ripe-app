import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/brand/fonts";
import { NotFoundView } from "@/components/not-found-view";

/*
 * Any address the site doesn't have. The app has two root layouts ((site) and
 * (bare)), so there's no single layout to hang a 404 on: Next renders this
 * page on its own (experimental.globalNotFound in next.config.ts), with its
 * own styles and fonts.
 */

export const metadata: Metadata = {
  title: "Page not found. BasketNG",
  description: "This page has gone off. Head back to fresh fruit and veg.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body>
        <NotFoundView />
      </body>
    </html>
  );
}
