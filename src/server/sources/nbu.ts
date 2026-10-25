import { getJson } from "../http";

export interface FxRate {
  /** UAH per 1 unit of `cc`. */
  rate: number;
  cc: string;
  /** NBU official date (dd.mm.yyyy as published). */
  date: string;
  sourceId: "nbu";
  fetchedAt: string;
}

interface NbuRow {
  r030: number;
  txt: string;
  rate: number;
  cc: string;
  exchangedate: string;
}

/** Official NBU rate (open API, no key). Cached 6 h; the rate is set once per banking day. */
export async function nbuRate(cc: "USD" | "EUR" = "USD"): Promise<FxRate | null> {
  const r = await getJson<NbuRow[]>(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${cc}&json`, { revalidate: 6 * 3600 });
  if (!r.ok || !Array.isArray(r.data) || !r.data[0]?.rate) return null;
  return { rate: r.data[0].rate, cc, date: r.data[0].exchangedate, sourceId: "nbu", fetchedAt: r.fetchedAt };
}
