import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The app icon: the wordmark's "B" in Dr Kabel, white on a black rounded
 * square, the same black as the logo and the "Get started" buttons. One
 * drawing at every size (browser tab, home screen, favicon.ico), so the
 * proportions below are fractions of the side.
 */
export async function iconMark(size: number, { rounded = true }: { rounded?: boolean } = {}) {
  const font = await readFile(join(process.cwd(), "src/fonts/DrKabel.otf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          // iOS rounds home-screen icons itself, so those stay square.
          borderRadius: rounded ? size * 0.22 : 0,
          color: "#fff",
          fontFamily: "Dr Kabel",
          fontSize: size * 0.78,
          // The display face sits a little high in its box; nudge it to the optical centre.
          paddingTop: size * 0.08,
          lineHeight: 1,
        }}
      >
        B
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Dr Kabel", data: font, style: "normal", weight: 400 }],
    },
  );
}
