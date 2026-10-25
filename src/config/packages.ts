/**
 * Service packages. Prices are WORKING HYPOTHESES to be validated by willingness-to-pay research
 * (docs/product.md §8). `priceUah` is the launch price charged at checkout (UAH is the primary
 * currency) — the server reads it from here, never from the client. EUR/USD are shown at the NBU rate.
 */
export type PackageId = "digital" | "full" | "advisory" | "commercial" | "legal" | "inspection";
/** Packages sold online (checkout). */
export const CHECKOUT_PACKAGES = ["digital", "legal", "inspection", "full", "advisory"] as const;
export type CheckoutPackageId = (typeof CHECKOUT_PACKAGES)[number];

export interface ServicePackage {
  id: PackageId;
  hypothesis: boolean;
  /** Launch price in UAH; null = custom scope (no online checkout). */
  priceUah: number | null;
  includes: { legal: boolean; inspection: boolean; advisory: boolean };
  highlight?: boolean;
  /** Single dossier module sold on its own (shown inside the report, not in the packages grid). */
  module?: boolean;
}

export const PACKAGES: ServicePackage[] = [
  { id: "digital", hypothesis: true, priceUah: 2490, includes: { legal: false, inspection: false, advisory: false } },
  { id: "full", hypothesis: true, priceUah: 14900, includes: { legal: true, inspection: true, advisory: false }, highlight: true },
  { id: "advisory", hypothesis: true, priceUah: 39900, includes: { legal: true, inspection: true, advisory: true } },
  { id: "commercial", hypothesis: true, priceUah: null, includes: { legal: true, inspection: true, advisory: true } },
  // Single modules — a client can add exactly the check they still need.
  { id: "legal", hypothesis: true, priceUah: 3900, includes: { legal: true, inspection: false, advisory: false }, module: true },
  { id: "inspection", hypothesis: true, priceUah: 6900, includes: { legal: false, inspection: true, advisory: false }, module: true },
];

export const GRID_PACKAGES = PACKAGES.filter((p) => !p.module);

export const getPackage = (id: string) => PACKAGES.find((p) => p.id === id);

/** Approximate price in another currency at the NBU rate (display only; the charge is in UAH). */
export const convertFromUah = (uah: number, uahPerUnit: number) => Math.round(uah / uahPerUnit);
