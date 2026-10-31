import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { transcribe } from "@/lib/kachi-model";
import { prisma } from "@/lib/prisma";
import { OFFERED } from "@/lib/product";

/*
 * Kachi's voice notes: a recording from the chat comes in, its words go back,
 * and the customer checks them before sending. The audio isn't kept.
 */

/** About a minute of compressed speech; the chat stops recording at 60 seconds. */
const MAX_BYTES = 3_000_000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to talk to Kachi." }, { status: 401 });
  if (!rateLimit(`kachi-voice:${user.id}`, 15, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "That's a lot of voice notes. Give it a minute, or type instead." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || !audio.size) return NextResponse.json({ error: "There was no recording." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That one's too long. Keep it under a minute." }, { status: 413 });
  // Browsers record webm (Chrome, Android) or mp4 (Safari); the codec part isn't needed.
  const mediaType = (audio.type || "audio/webm").split(";")[0];
  if (!/^audio\/(webm|mp4|mpeg|ogg|wav|aac|x-m4a)$/.test(mediaType)) return NextResponse.json({ error: "That recording format isn't one we can read." }, { status: 415 });

  try {
    // Our produce names, so "ugu" or "agbalumo" come out as we spell them.
    const names = (await prisma.product.findMany({ where: OFFERED, select: { name: true } })).map((p) => p.name.replace(/\s*\(.*\)$/, ""));
    const text = await transcribe(new Uint8Array(await audio.arrayBuffer()), mediaType, ["Kachi", "Basket", ...names]);
    if (!text) return NextResponse.json({ error: "I couldn't hear anything there. Try again a little closer?" }, { status: 422 });
    return NextResponse.json({ text: text.slice(0, 2000) });
  } catch (err) {
    console.error(JSON.stringify({ scope: "kachi-voice", userId: user.id, error: String(err).slice(0, 300) }));
    return NextResponse.json({ error: "I couldn't make that out just now. Try again, or type it?" }, { status: 500 });
  }
}
