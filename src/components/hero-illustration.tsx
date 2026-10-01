"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./hero-illustration.module.css";

type Shape = "coin" | "pill" | "ring" | "star" | "dot";

type Sticker = {
  shape: Shape;
  className: string;
  top: string;
  left: string;
  size: number;
  // Parallax depth: negative sits behind the art and moves against the pointer.
  depth: number;
  delay: number;
  duration: number;
  drift: [number, number, number];
  rotate?: number;
};

// Placed in the cutout's empty margins so nothing sits over a face.
const BACK: Sticker[] = [
  { shape: "coin", className: "bg-sunburst", top: "3%", left: "8%", size: 46, depth: -0.7, delay: 380, duration: 7, drift: [6, -10, 14] },
  { shape: "pill", className: "bg-electric-blue", top: "6%", left: "89%", size: 22, depth: -0.9, delay: 460, duration: 8.5, drift: [-8, 8, -10], rotate: 32 },
  { shape: "ring", className: "border-mint-pop", top: "86%", left: "80%", size: 34, depth: -0.5, delay: 540, duration: 9, drift: [8, -6, 20] },
];

const FRONT: Sticker[] = [
  { shape: "dot", className: "bg-voltage-violet", top: "80%", left: "3%", size: 26, depth: 1.8, delay: 620, duration: 6, drift: [-6, -10, 0] },
  { shape: "star", className: "fill-lavender", top: "58%", left: "94%", size: 42, depth: 1.6, delay: 700, duration: 7.5, drift: [5, -12, 18] },
];

function StickerShape({ s }: { s: Sticker }) {
  if (s.shape === "star") {
    return (
      <svg viewBox="0 0 24 24" className={`h-full w-full ${s.className}`}>
        <path
          d="M12 1c1 7 4 10 11 11-7 1-10 4-11 11-1-7-4-10-11-11 7-1 10-4 11-11Z"
          stroke="var(--carbon)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  if (s.shape === "ring") {
    return <span className={`block h-full w-full rounded-full border-[7px] ${s.className} outline-solid outline-[1.5px] outline-carbon`} />;
  }
  return (
    <span
      className={`block h-full w-full rounded-full border-[1.5px] border-carbon ${s.className}`}
      style={s.rotate ? { transform: `rotate(${s.rotate}deg)` } : undefined}
    />
  );
}

function StickerLayer({ s }: { s: Sticker }) {
  const height = s.shape === "pill" ? s.size * 2.6 : s.size;
  return (
    <div className={styles.layer} style={{ "--depth": s.depth } as CSSProperties} aria-hidden>
      <div
        className={styles.sticker}
        style={{ top: s.top, left: s.left, width: s.size, height, "--delay": `${s.delay}ms` } as CSSProperties}
      >
        <div
          className={styles.drift}
          style={
            {
              "--dx": `${s.drift[0]}px`,
              "--dy": `${s.drift[1]}px`,
              "--spin": `${s.drift[2]}deg`,
              "--duration": `${s.duration}s`,
            } as CSSProperties
          }
        >
          <StickerShape s={s} />
        </div>
      </div>
    </div>
  );
}

/**
 * Hero cutout with a three-part motion system: an elastic "inflate" entrance,
 * a slow idle bob, and pointer parallax that tilts the art and shifts the
 * sticker shapes at different depths. Parallax is skipped on touch devices and
 * everything is skipped under prefers-reduced-motion.
 */
export function HeroIllustration() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    let center = { x: 0, y: 0 };

    const measure = () => {
      const r = stage.getBoundingClientRect();
      center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    // Eased toward the pointer each frame, so the motion trails like something
    // with weight rather than snapping to the cursor.
    const tick = () => {
      current.x += (target.x - current.x) * 0.07;
      current.y += (target.y - current.y) * 0.07;
      stage.style.setProperty("--px", current.x.toFixed(4));
      stage.style.setProperty("--py", current.y.toFixed(4));
      const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    const onMove = (e: PointerEvent) => {
      target = {
        x: clamp((e.clientX - center.x) / (window.innerWidth / 2)),
        y: clamp((e.clientY - center.y) / (window.innerHeight / 2)),
      };
      run();
    };
    const onLeave = () => {
      target = { x: 0, y: 0 };
      run();
    };

    measure();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={stageRef} className={styles.stage}>
      {BACK.map((s) => (
        <StickerLayer key={`${s.shape}-${s.left}`} s={s} />
      ))}

      <div className={`${styles.layer} ${styles.art}`}>
        <div className={styles.pop}>
          <div className={styles.bob}>
            <Image
              src="/images/hero-basket.webp"
              alt="Three friends cheering behind a woven basket overflowing with tomatoes, carrots, bananas, peppers and greens"
              width={1600}
              height={1135}
              priority
              sizes="(min-width: 1024px) 560px, 90vw"
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>

      {FRONT.map((s) => (
        <StickerLayer key={`${s.shape}-${s.left}`} s={s} />
      ))}
    </div>
  );
}
