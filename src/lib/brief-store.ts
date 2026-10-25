"use client";

import type { BriefDraft } from "@/domain/brief";

const KEY = "bi.brief.v1";

/** Brief answers live in the browser only until the user explicitly submits them. */
export function loadBrief(): BriefDraft {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BriefDraft) : {};
  } catch {
    return {};
  }
}

export function saveBrief(draft: BriefDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage blocked: wizard still works in memory */
  }
}

export function clearBrief() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
