/**
 * The page's illustration set. Flat, no outlines, no faces: each piece is a
 * brand colour with one deeper tone of itself for the shadow side and a soft
 * highlight, so the drawings sit beside real food photography without
 * looking like a children's book. Every piece is drawn on a 100 x 100 grid.
 */

import type { SVGProps } from "react";

/** Brand colours plus the one deeper tone each needs for its shadow side. */
export const INK = {
  mint: "#55db9c",
  mintDeep: "#1f9e63",
  leaf: "#2bbd78",
  lime: "#c9f27a",
  ember: "#fb4903",
  emberDeep: "#c43600",
  tomato: "#ff5a2b",
  sun: "#ffd731",
  sunDeep: "#f0a800",
  carrot: "#ff8a1c",
  carrotDeep: "#e0640a",
  flesh: "#eef7bf",
  pit: "#8a4b26",
  violet: "#5c4ade",
  violetDeep: "#4434b8",
  blue: "#4da2ff",
  sky: "#dceeff",
  lavender: "#e9ccff",
  cream: "#fff6e3",
  bark: "#a86a3d",
  melon: "#ff4f5e",
  carbon: "#000000",
} as const;

type ArtProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: ArtProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

export function Tomato(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M50 24c23 0 40 14 40 35S73 93 50 93 10 80 10 59s17-35 40-35z" fill={INK.tomato} />
      <path d="M90 59c0 21-17 34-40 34-9 0-17-2-24-6 26 2 46-12 50-36 2-8 0-15-3-20 10 6 17 16 17 28z" fill={INK.emberDeep} opacity=".55" />
      <ellipse cx="31" cy="44" rx="9" ry="5.5" transform="rotate(-28 31 44)" fill="#fff" opacity=".42" />
      <path d="M50 30c-3-6-10-8-17-6 5 2 8 5 9 8-6 0-11 3-13 8 6-2 11-2 15 0-1 4 0 8 3 11 1-4 3-7 6-9 3 2 5 5 6 9 3-3 4-7 3-11 4-2 9-2 15 0-2-5-7-8-13-8 1-3 4-6 9-8-7-2-14 0-17 6z" fill={INK.leaf} />
      <path d="M49 31c0-6 1-12 4-17" stroke={INK.mintDeep} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

export function AvocadoHalf(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M50 6c13 0 20 14 26 30 6 15 16 24 16 38 0 13-15 22-42 22S8 87 8 74c0-14 10-23 16-38C30 20 37 6 50 6z" fill={INK.mintDeep} />
      <path d="M50 14c9 0 15 11 20 25 5 13 14 21 14 33 0 10-12 17-34 17S16 82 16 72c0-12 9-20 14-33 5-14 11-25 20-25z" fill={INK.lime} />
      <path d="M50 22c7 0 11 9 15 20 4 10 11 17 11 27 0 8-9 13-26 13s-26-5-26-13c0-10 7-17 11-27 4-11 8-20 15-20z" fill={INK.flesh} />
      <circle cx="50" cy="64" r="15" fill={INK.pit} />
      <path d="M62 56c3 8 0 17-8 21 4-7 5-14 2-21-1-3 3-4 6 0z" fill="#000" opacity=".22" />
      <ellipse cx="44" cy="58" rx="5" ry="3.2" transform="rotate(-35 44 58)" fill="#fff" opacity=".4" />
    </Svg>
  );
}

export function LimeSlice(props: ArtProps) {
  const wedges = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <Svg {...props}>
      <circle cx="50" cy="50" r="44" fill={INK.mintDeep} />
      <circle cx="50" cy="50" r="38" fill={INK.flesh} />
      {wedges.map((a) => (
        <path key={a} d="M50 50 L50 17 A33 33 0 0 1 72.4 25.7 Z" transform={`rotate(${a} 50 50)`} fill={INK.lime} />
      ))}
      <circle cx="50" cy="50" r="5" fill={INK.flesh} />
      <path d="M50 6a44 44 0 0 1 44 44h-6a38 38 0 0 0-38-38z" fill="#fff" opacity=".18" />
    </Svg>
  );
}

export function Chilli(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M74 22c6 2 9 8 7 15-6 22-27 46-56 56-6 2-10-5-5-9 22-15 33-33 38-54 2-7 9-10 16-8z" fill={INK.ember} />
      <path d="M81 37c-6 22-27 46-56 56-4 1-7-2-7-5 27-9 47-31 54-55 1-4 1-8-1-11 7 2 12 8 10 15z" fill={INK.emberDeep} opacity=".5" />
      <path d="M60 32c3-7 9-11 16-10" stroke="#fff" strokeOpacity=".45" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M72 23c1-6 5-11 11-13 3-1 4 3 2 4-4 2-6 5-7 10z" fill={INK.leaf} />
      <path d="M66 25c4-4 12-5 17 0-3 3-10 4-17 0z" fill={INK.mintDeep} />
    </Svg>
  );
}

export function Sprig(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M50 96C48 70 50 40 60 8" stroke={INK.mintDeep} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M53 70c-12-2-22-10-25-22 12 1 22 9 25 22z" fill={INK.leaf} />
      <path d="M53 52c11-4 22-2 28 7-11 3-22 1-28-7z" fill={INK.mint} />
      <path d="M55 38c-10-5-15-14-14-25 10 4 15 13 14 25z" fill={INK.mint} />
      <path d="M58 26c8-6 17-7 25-2-7 6-17 7-25 2z" fill={INK.leaf} />
      <path d="M51 84c-10 0-19-5-23-14 10-1 19 4 23 14z" fill={INK.mint} />
    </Svg>
  );
}

export function Mango(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M58 18c20 4 33 22 30 44-3 21-21 34-42 31C24 90 10 74 13 54c2-14 11-20 20-28 7-6 14-10 25-8z" fill={INK.sun} />
      <path d="M58 18c20 4 33 22 30 44-2 15-12 26-26 30 12-10 17-24 15-40-2-15-10-27-19-34z" fill={INK.ember} opacity=".75" />
      <path d="M88 62c-3 21-21 34-42 31-9-1-17-5-23-11 22 6 47-4 54-28 2-6 2-12 1-17 7 7 11 16 10 25z" fill={INK.emberDeep} opacity=".35" />
      <ellipse cx="32" cy="45" rx="8" ry="5" transform="rotate(-40 32 45)" fill="#fff" opacity=".45" />
      <path d="M55 19c-2-6-1-11 3-15" stroke={INK.pit} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M58 9c9-6 21-5 28 2-10 5-20 5-28-2z" fill={INK.leaf} />
    </Svg>
  );
}

export function Carrot(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M67 30c8 6 8 15 2 22L26 92c-4 4-11-1-8-6l33-50c4-7 10-10 16-6z" fill={INK.carrot} />
      <path d="M69 52 26 92c-3 3-7 2-8 0 19-15 37-34 50-54 2-4 3-8 3-11 4 6 4 18-2 25z" fill={INK.carrotDeep} opacity=".55" />
      <path d="M40 58l7 4M33 70l6 3M50 45l7 5" stroke={INK.carrotDeep} strokeWidth="3" strokeLinecap="round" />
      <path d="M66 31c-2-10 1-19 8-25 2 8 0 17-8 25z" fill={INK.leaf} />
      <path d="M67 31c5-8 13-12 22-10-4 7-12 11-22 10z" fill={INK.mint} />
      <path d="M66 31c-7-6-9-14-6-22 6 5 8 13 6 22z" fill={INK.mintDeep} />
    </Svg>
  );
}

export function GardenEgg(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M50 24c22 0 36 16 36 36S70 94 48 94 12 80 13 60c1-21 15-36 37-36z" fill={INK.cream} />
      <path d="M86 60c0 20-16 34-38 34-10 0-19-3-26-9 26 4 49-12 50-37 0-5-1-10-3-14 10 6 17 15 17 26z" fill={INK.lime} opacity=".75" />
      <ellipse cx="33" cy="47" rx="9" ry="5.5" transform="rotate(-30 33 47)" fill="#fff" opacity=".9" />
      <path d="M50 22c-9 0-17 4-21 11 7-1 13 0 17 4 2-4 3-8 4-15zM50 22c9 0 17 4 21 11-7-1-13 0-17 4-2-4-3-8-4-15z" fill={INK.leaf} />
      <path d="M50 24V10" stroke={INK.mintDeep} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

export function Melon(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M8 40h84c0 26-19 46-42 46S8 66 8 40z" fill={INK.mintDeep} />
      <path d="M14 40h72c0 21-16 40-36 40S14 61 14 40z" fill={INK.flesh} />
      <path d="M19 40h62c0 18-14 34-31 34S19 58 19 40z" fill={INK.melon} />
      <path d="M81 40c0 18-14 34-31 34-6 0-11-1-15-4 21-1 37-14 39-30z" fill="#000" opacity=".1" />
      {[
        [34, 50],
        [50, 56],
        [66, 50],
        [42, 64],
        [58, 64],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="2.2" ry="3.4" fill={INK.carbon} />
      ))}
    </Svg>
  );
}

export function Mushroom(props: ArtProps) {
  return (
    <Svg {...props}>
      <path d="M40 52h20l4 34c1 5-3 8-8 8H44c-5 0-9-3-8-8z" fill={INK.cream} />
      <path d="M60 52l4 34c1 5-3 8-8 8h-6c5 0 8-3 7-8l-3-34z" fill="#000" opacity=".08" />
      <path d="M50 12c26 0 42 18 42 36 0 6-5 8-10 8H18c-5 0-10-2-10-8 0-18 16-36 42-36z" fill={INK.bark} />
      <path d="M92 48c0 6-5 8-10 8H40c26-2 40-17 38-38 9 7 14 19 14 30z" fill="#000" opacity=".16" />
      <ellipse cx="34" cy="28" rx="9" ry="5" transform="rotate(-24 34 28)" fill="#fff" opacity=".3" />
    </Svg>
  );
}

/** A four-point star, for the small accents around a cluster. */
export function Sparkle({ color = INK.sun, ...props }: ArtProps & { color?: string }) {
  return (
    <Svg {...props}>
      <path d="M50 4c4 26 20 42 46 46-26 4-42 20-46 46-4-26-20-42-46-46C30 46 46 30 50 4z" fill={color} />
    </Svg>
  );
}

/** A full salad bowl seen from the side. The centrepiece of the closing scene. */
export function Bowl(props: ArtProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" aria-hidden focusable="false" {...props}>
      {/* the heap */}
      <path d="M38 76c-6-20 10-36 26-30 4-18 26-24 38-10 12-14 36-10 40 8 16-4 28 14 20 32z" fill={INK.leaf} />
      <path d="M58 70c-2-14 10-22 20-17M104 58c2-12 16-16 24-8M138 66c4-8 14-8 18 0" stroke={INK.mintDeep} strokeWidth="4" strokeLinecap="round" />
      <circle cx="84" cy="56" r="11" fill={INK.tomato} />
      <ellipse cx="80" cy="52" rx="3.6" ry="2.2" transform="rotate(-30 80 52)" fill="#fff" opacity=".45" />
      <circle cx="132" cy="54" r="9" fill={INK.tomato} />
      <path d="M100 44a14 14 0 0 1 24 4h-24z" fill={INK.lime} />
      <path d="M100 44a14 14 0 0 1 24 4" stroke={INK.mintDeep} strokeWidth="3" />
      <ellipse cx="62" cy="58" rx="9" ry="6" fill={INK.sun} />
      <ellipse cx="152" cy="66" rx="7" ry="5" fill={INK.sun} />
      <path d="M108 30c4 4 4 9 0 13" stroke={INK.mint} strokeWidth="4" strokeLinecap="round" />
      {/* the bowl */}
      <path d="M22 74h156c0 34-35 58-78 58S22 108 22 74z" fill={INK.violet} />
      <path d="M178 74c0 34-35 58-78 58-14 0-27-2-38-7 52 2 92-20 98-51z" fill={INK.violetDeep} />
      <rect x="18" y="68" width="164" height="12" rx="6" fill={INK.blue} />
      <path d="M44 92c8 12 22 20 38 23" stroke="#fff" strokeOpacity=".3" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** Kachi's mark: a mint disc with a spark. Used wherever Kachi speaks. */
export function KachiMark({ className = "" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-mint-pop ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]">
        <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z" fill="#000" />
      </svg>
    </span>
  );
}

export const PRODUCE_ART = { Tomato, AvocadoHalf, LimeSlice, Chilli, Sprig, Mango, Carrot, GardenEgg, Melon, Mushroom } as const;
export type ProduceArtName = keyof typeof PRODUCE_ART;
