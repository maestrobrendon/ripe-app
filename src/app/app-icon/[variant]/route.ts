import { iconMark } from "@/brand/icon-mark";

/*
 * The installed app's icons, for the web app manifest: /app-icon/192,
 * /app-icon/512, and /app-icon/maskable (512, full-bleed, the "B" inside the
 * safe zone so Android's circle or squircle crop never cuts it).
 */
const VARIANTS: Record<string, { size: number; rounded: boolean; glyph: number }> = {
  "192": { size: 192, rounded: true, glyph: 1 },
  "512": { size: 512, rounded: true, glyph: 1 },
  maskable: { size: 512, rounded: false, glyph: 0.7 },
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const v = VARIANTS[(await params).variant];
  if (!v) return new Response("Not found", { status: 404 });
  const res = await iconMark(v.size, { rounded: v.rounded, glyph: v.glyph });
  res.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return res;
}
