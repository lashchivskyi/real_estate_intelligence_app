/** Compare against the nearest edge; avoid implying a premium for an in-range price. */
export function pricePosition(ask: number, low: number, high: number) {
  const position = ask > high ? "above" : ask < low ? "below" : "within";
  const edge = position === "above" ? high : position === "below" ? low : ask;
  const difference = Math.abs(ask - edge);
  return { position, difference, percent: edge > 0 ? (difference / edge) * 100 : 0 } as const;
}
