import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

/*
 * The wordmark as a picture, for the top of every email (lib/email-layout.ts).
 * Mail clients can't load Dr Kabel, so the logo is drawn here instead: black
 * on transparent, at twice the size it's shown for sharp screens.
 */

export const dynamic = "force-static";

export async function GET() {
  const font = await readFile(join(process.cwd(), "src/fonts/DrKabel.otf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", color: "#000", fontFamily: "Dr Kabel", fontSize: 50, lineHeight: 1, paddingTop: 6, letterSpacing: "-0.01em" }}>
        {SITE_NAME}
      </div>
    ),
    {
      width: 264,
      height: 64,
      fonts: [{ name: "Dr Kabel", data: font, style: "normal", weight: 400 }],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
