"use client";

/**
 * Thin analytics layer. Call sites never change when the sink does
 * (PostHog / Plausible adapters can be added behind `send`).
 * No PII in props — only ids, enums and counts.
 */
export type EventName =
  | "brief_started"
  | "brief_step_completed"
  | "brief_completed"
  | "property_added"
  | "report_requested"
  | "report_viewed"
  | "comparison_created"
  | "inspection_requested"
  | "consultation_requested"
  | "purchase_completed"
  | "city_changed"
  | "city_detected"
  | "report_printed"
  | "language_changed"
  | "currency_changed";

type Props = Record<string, string | number | boolean | undefined>;

function send(event: EventName, props: Props) {
  const body = JSON.stringify({ event, props, path: location.pathname, ts: Date.now() });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through */
  }
  fetch("/api/analytics", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

export function track(event: EventName, props: Props = {}) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") console.debug("[analytics]", event, props);
  send(event, props);
}
