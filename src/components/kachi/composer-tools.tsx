"use client";

import { useEffect, useRef, useState } from "react";

/*
 * The photo and voice buttons beside Kachi's message box. A photo is shrunk
 * on the phone (longest side 1280px, JPEG) before it goes anywhere. A voice
 * note records until it's tapped again (a minute at most), then comes back
 * as words in the box, to check before sending.
 */

const MAX_SIDE = 1280;
const MAX_RECORDING_MS = 60_000;

/** A picked image file as a smaller JPEG data URL. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function ComposerTools({
  disabled,
  onPhoto,
  onTranscript,
  onError,
  size = "md",
}: {
  disabled?: boolean;
  onPhoto: (dataUrl: string) => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  size?: "sm" | "md";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<number | undefined>(undefined);
  const [state, setState] = useState<"idle" | "recording" | "writing">("idle");
  const [canRecord, setCanRecord] = useState(false);

  // Recording needs a browser that has it; checked after mounting so the server HTML matches.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCanRecord(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)), []);
  useEffect(() => () => window.clearTimeout(stopTimer.current), []);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onError("That isn't a photo.");
    try {
      onPhoto(await shrink(file));
    } catch {
      onError("I couldn't open that photo. Try another?");
    }
  };

  const record = async () => {
    if (state === "recording") {
      recorder.current?.stop();
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("Kachi needs your microphone for voice notes. You can allow it in your browser settings.");
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      window.clearTimeout(stopTimer.current);
      stream.getTracks().forEach((t) => t.stop());
      setState("writing");
      try {
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "voice-note");
        const res = await fetch("/api/assistant/transcribe", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (data.text) onTranscript(data.text);
        else onError(data.error ?? "I couldn't make that out. Try again?");
      } catch {
        onError("I couldn't reach the server. Check your connection and try again.");
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    stopTimer.current = window.setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORDING_MS);
  };

  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const button = `grid ${box} shrink-0 place-items-center rounded-full text-carbon/70 transition-colors hover:bg-black/[0.06] disabled:opacity-30`;

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ""))} />
      <button type="button" aria-label="Send a photo" disabled={disabled || state !== "idle"} onClick={() => fileRef.current?.click()} className={button}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </button>
      {canRecord && (
        <button
          type="button"
          aria-label={state === "recording" ? "Stop and write it down" : state === "writing" ? "Writing it down" : "Send a voice note"}
          aria-pressed={state === "recording"}
          disabled={disabled || state === "writing"}
          onClick={() => void record()}
          className={`${button} ${state === "recording" ? "bg-ember text-white hover:bg-ember" : ""}`}
        >
          {state === "writing" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-carbon/20 border-t-carbon" aria-hidden />
          ) : state === "recording" ? (
            <span className="h-3 w-3 rounded-[3px] bg-white" aria-hidden />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="3.5" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}

/** The photo waiting to go with the next message, with a way to take it back. */
export function PhotoPreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative mb-2 ml-1 w-fit">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL, nothing for next/image to optimise */}
      <img src={src} alt="Photo to send" className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/10" />
      <button type="button" onClick={onRemove} aria-label="Remove the photo" className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-carbon text-white">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}
