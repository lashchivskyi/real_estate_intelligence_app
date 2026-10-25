"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades/slides content in once when it enters the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Headline line that rises out of a mask. */
export function MaskLine({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`block overflow-hidden pb-[0.12em] ${className ?? ""}`}>
      <motion.span
        className="block"
        initial={reduce ? { opacity: 0 } : { y: "105%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Counts up to `value` when scrolled into view; shows the final value at once for reduced motion. */
export function CountUp({
  value,
  format,
  duration = 1.1,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setShown(v) });
    return () => c.stop();
  }, [inView, value, duration, reduce]);
  // Reduced motion (or before the animation starts for SSR/no-JS) falls back to the real value.
  const display = reduce ? value : (shown ?? value);
  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}

/** Animated-height container for accordions; honors reduced motion. */
export function Collapse({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      id={id}
      data-collapsible
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
      style={{ overflow: "hidden" }}
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </motion.div>
  );
}

export { motion, useReducedMotion };
