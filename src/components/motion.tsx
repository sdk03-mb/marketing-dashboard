"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

/** Popover open/close. */
export const POP = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] as const },
};

/** Content panel swap (tab change, period change). */
export const PANEL = {
  // Opacity only: any translate makes the exiting panel overflow and flashes a scrollbar.
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] as const },
};

/** Staggered list item. */
export const ITEM = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, delay: Math.min(i, 8) * 0.04, ease: [0.2, 0.8, 0.2, 1] as const },
});

/** Sliding background for segmented controls; render inside the active button. */
export function Pill({ id, className }: { id: string; className: string }) {
  return <motion.span layoutId={id} className={className} transition={{ type: "spring", stiffness: 500, damping: 40 }} />;
}

export type MotionDivProps = HTMLMotionProps<"div">;
