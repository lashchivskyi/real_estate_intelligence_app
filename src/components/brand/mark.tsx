import { cn } from "@/lib/cn";

/**
 * Vidomo mark v2 — "the lit window in focus".
 *   Focus frame (4 corners)  = due diligence: we bring one property into focus.
 *   House outline (cobalt)   = the property.
 *   Lit window (amber)       = what's inside is now known — the insight a buyer gets before signing.
 * Animates once on mount (frame converges → house draws → window lights) and the window flickers on hover.
 * Same construction as the Three.js version (three/logo-3d.tsx).
 */
export function Mark({ size = 28, animated = true, className }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("vd-mark shrink-0 overflow-visible", animated && "vd-mark--anim", className)} aria-hidden>
      <g fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path className="vd-c vd-c-tl" d="M4 10V4h6" />
        <path className="vd-c vd-c-tr" d="M22 4h6v6" />
        <path className="vd-c vd-c-br" d="M28 22v6h-6" />
        <path className="vd-c vd-c-bl" d="M10 28H4v-6" />
      </g>
      <path className="vd-house" d="M9.5 23.5V15.2L16 9.5l6.5 5.7v8.3Z" fill="none" stroke="var(--brand)" strokeWidth="2.3" strokeLinejoin="round" pathLength={100} />
      <rect className="vd-win" x="14.1" y="16.6" width="3.8" height="3.8" rx="0.7" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ size = 26, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <span className="group inline-flex items-center gap-2">
      <Mark size={size} animated={animated} />
      <span className="text-[19px] font-semibold tracking-[-0.045em]">vidomo</span>
    </span>
  );
}
