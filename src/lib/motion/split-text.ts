"use client";

/**
 * SplitText, registered on top of the shared setup in ./gsap. Kept out of
 * ./gsap so the pages that never split a headline don't download it:
 *
 *   import { SplitText } from "@/lib/motion/split-text";
 */

import { SplitText } from "gsap/SplitText";
import { gsap } from "./gsap";

gsap.registerPlugin(SplitText);

export { SplitText };
