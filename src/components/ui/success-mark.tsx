"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";

/**
 * The "done" moment: a mint disc lands with a little bounce, a soft ring
 * breathes out from it, and the check draws itself in. Felt as well as seen
 * where the phone allows it. With reduced motion, it simply appears.
 */
export function SuccessMark({ size = 76 }: { size?: number }) {
  useEffect(() => {
    haptic("success");
  }, []);

  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full bg-mint-pop"
        initial={{ scale: 0.6, opacity: 0.5 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      />
      <motion.svg viewBox="0 0 72 72" width={size} height={size} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={spring.juicy}>
        <circle cx="36" cy="36" r="36" className="fill-mint-pop" />
        <motion.path
          d="M22 37.5l9.5 9.5L51 27"
          fill="none"
          stroke="#000"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.22, duration: 0.42, ease: [0.65, 0, 0.35, 1] }}
        />
      </motion.svg>
    </span>
  );
}
