"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Fires `purchase_completed` once, only after the server verified the payment. */
export function PurchaseTracker({ order, provider }: { order: string; provider: string }) {
  useEffect(() => {
    const key = `bi.purchase.${order}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    track("purchase_completed", { provider });
  }, [order, provider]);
  return null;
}
