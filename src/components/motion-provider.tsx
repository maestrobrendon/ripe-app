"use client";

import { MotionConfig } from "motion/react";
import { spring } from "@/lib/motion/tokens";

/**
 * Wrap the app once (in layout.tsx). Gives every motion.* element the brand
 * default spring and makes Motion honour prefers-reduced-motion
 * (transform/layout animations are disabled; opacity/colour still animate).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={spring.snappy}>
      {children}
    </MotionConfig>
  );
}
