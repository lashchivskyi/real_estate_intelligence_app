import type { Essential } from "@/domain/location/geo";

/** 24px stroke glyphs for essentials. Exported as raw SVG strings too (for MapLibre HTML markers). */
export const ESSENTIAL_PATHS: Record<Essential, string> = {
  transit: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l1.5-4M16 21l-1.5-4"/><circle cx="8.5" cy="14" r=".8"/><circle cx="15.5" cy="14" r=".8"/>',
  grocery: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  pharmacy: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  kindergarten: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>',
  clinic: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/><path d="M12 10v4M10 12h4"/>',
  park: '<path d="M12 22v-6"/><path d="M12 3l5 7h-3l4 6H6l4-6H7z"/>',
};

export const essentialSvg = (cat: Essential, size = 16, stroke = "currentColor") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ESSENTIAL_PATHS[cat]}</svg>`;

export function EssentialIcon({ cat, size = 16 }: { cat: Essential; size?: number }) {
  return <span aria-hidden className="inline-grid" dangerouslySetInnerHTML={{ __html: essentialSvg(cat, size) }} />;
}
