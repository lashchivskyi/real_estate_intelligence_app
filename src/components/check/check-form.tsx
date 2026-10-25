"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BUILDING_TYPES, CONDITIONS, MARKETS, apartmentInputSchema } from "@/domain/property/types";
import { getCityOrDefault } from "@/domain/location/registry";
import { metres } from "@/domain/location/intel";
import type { AddressSuggestion, NearbyPlace } from "@/domain/location/geo";
import { AddressAutocomplete } from "../map/address-autocomplete";
import { LocationExplorer } from "../map/location-explorer";
import { NumberInput } from "../ui/number-input";
import { DocumentDrop } from "./document-drop";
import { track } from "@/lib/analytics";
import { loadBrief } from "@/lib/brief-store";
import { propertyToParams } from "@/lib/report-service";
import { cn } from "@/lib/cn";
import { Reveal, motion } from "../motion";
import { useCity, useI18n } from "../providers";
import { Button, Card, Field, Input, Select } from "../ui/primitives";


type Tab = "url" | "manual" | "docs";

export function CheckForm() {
  const { dict, lang, href, f, rates } = useI18n();
  const { cityId } = useCity();
  const router = useRouter();
  const d = dict.check;
  const city = getCityOrDefault(cityId);
  const [tab, setTab] = useState<Tab>("manual");
  const [useBrief, setUseBrief] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [picked, setPicked] = useState<AddressSuggestion | null>(null);
  const [districtId, setDistrictId] = useState("");
  const [districtAuto, setDistrictAuto] = useState<null | "admin" | "nearest">(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [askCur, setAskCur] = useState<"USD" | "UAH" | "EUR">("USD");

  // Typing after picking invalidates the exact point.
  useEffect(() => {
    if (picked && !address.startsWith(picked.street ?? picked.label.split(" — ")[0])) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- address edited by hand
      setPicked(null);
      setPlaces([]);
    }
  }, [address, picked]);

  async function onPick(s: AddressSuggestion) {
    setPicked(s);
    // District from administrative boundaries (reverse geocoding), nearest centre as a fallback.
    const near = city.districts.map((x) => ({ id: x.id, m: metres(s.point, x.center) })).sort((a, b) => a.m - b.m)[0];
    if (near && near.m < 2500) {
      setDistrictId(near.id);
      setDistrictAuto("nearest");
    }
    fetch(`/api/geo/district?city=${city.id}&lat=${s.point[1]}&lng=${s.point[0]}`)
      .then((r) => r.json())
      .then((j: { districtId?: string | null; method?: "admin" | "nearest" | null }) => {
        if (j.districtId) {
          setDistrictId(j.districtId);
          setDistrictAuto(j.method ?? "nearest");
        }
      })
      .catch(() => {});
    setLoadingPlaces(true);
    try {
      const r = await fetch(`/api/geo/nearby?lat=${s.point[1]}&lng=${s.point[0]}`);
      const j = (await r.json()) as { places?: NearbyPlace[] };
      setPlaces(j.places ?? []);
    } catch {
      setPlaces([]);
    } finally {
      setLoadingPlaces(false);
    }
  }

  const subject = useMemo(() => (picked ? { point: picked.point, precise: picked.precise } : null), [picked]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string" && v.trim() !== "") raw[k] = v.trim();
    });
    // Listing prices may be quoted in USD, UAH or EUR — normalise to the market currency at the NBU rate.
    if (raw.askingPrice && askCur !== city.currency) {
      const uah = askCur === "UAH" ? Number(raw.askingPrice) : Number(raw.askingPrice) * (rates[askCur] ?? NaN);
      const target = city.currency === "UAH" ? uah : uah / (rates[city.currency as "USD" | "EUR"] ?? NaN);
      if (Number.isFinite(target)) raw.askingPrice = String(Math.round(target));
    }
    const parsed = apartmentInputSchema.safeParse({ ...raw, cityId: city.id });
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
      return;
    }
    setErrors([]);
    const brief = useBrief ? loadBrief() : undefined;
    const q = propertyToParams({ ...parsed.data, coords: picked?.point }, brief && { purpose: brief.purpose, household: brief.household, priorities: brief.priorities });
    track("property_added", { source: tab, city: city.id, hasUrl: !!parsed.data.sourceUrl });
    track("report_requested", { city: city.id });
    router.push(`${href("/report")}?${q.toString()}`);
  }

  const err = (k: string) => errors.includes(k);
  const tabs: Array<[Tab, string]> = [
    ["url", d.tabs.url],
    ["manual", d.tabs.manual],
    ["docs", d.tabs.docs],
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div role="tablist" aria-label={d.title} className="inline-flex rounded-full border border-line bg-surface p-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="relative rounded-full px-4 py-1.5 text-sm font-medium"
          >
            {tab === id && <motion.span layoutId="check-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
            <span className={cn("relative", tab === id ? "text-bg" : "text-ink2")}>{label}</span>
          </button>
        ))}
      </div>

      {tab === "url" && (
        <Reveal y={6}>
          <Card>
            <Field label={d.urlLabel} htmlFor="u" hint={d.urlHint}>
              <Input id="u" name="sourceUrl" type="url" inputMode="url" placeholder="https://" maxLength={500} />
            </Field>
          </Card>
        </Reveal>
      )}
      {tab === "docs" && (
        <Reveal y={6}>
          <DocumentDrop />
        </Reveal>
      )}

      <Card>
        {city.status !== "live" && <p className="mb-5 rounded-lg bg-warnbg px-3 py-2 text-sm">{d.unsupportedCity}</p>}
        <Field label={d.fields.address} htmlFor="a" optional={dict.common.optional} hint={dict.nearby.hint}>
          <AddressAutocomplete id="a" name="address" cityId={city.id} value={address} onChange={setAddress} onSelect={onPick} />
        </Field>
        {picked && subject && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="-mx-2 mt-5 sm:-mx-4">
            <LocationExplorer subject={subject} places={places} loading={loadingPlaces} />
          </motion.div>
        )}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label={d.fields.district} htmlFor="d" optional={districtAuto ? undefined : dict.common.optional} hint={districtAuto ? d.districtAuto : undefined}>
            <Select
              id="d"
              name="districtId"
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value);
                setDistrictAuto(null);
              }}
              className={cn(districtAuto && "border-brand/60 bg-brand/5")}
            >
              <option value="">{d.fields.districtAny}</option>
              {city.districts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.names[lang]}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <Field label={d.fields.askingPriceShort} htmlFor="ask">
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <NumberInput
                    id="ask"
                    name="askingPrice"
                    required
                    aria-invalid={err("askingPrice")}
                    className={cn("text-base font-semibold", err("askingPrice") && "border-bad")}
                    placeholder={askCur === "UAH" ? "4 500 000" : "100 000"}
                  />
                </div>
                <div className="flex shrink-0 rounded-xl border border-line bg-surface p-0.5" role="radiogroup" aria-label={dict.nav.currency}>
                  {(["USD", "UAH", "EUR"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={askCur === c}
                      onClick={() => setAskCur(c)}
                      className={cn("w-7 rounded-lg text-sm font-semibold transition-colors", askCur === c ? "bg-ink text-bg" : "text-ink2 hover:text-ink")}
                    >
                      {c === "USD" ? "$" : c === "UAH" ? "₴" : "€"}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>
          <Field label={d.fields.area} htmlFor="area">
            <NumberInput id="area" name="areaSqm" decimals hint={false} required aria-invalid={err("areaSqm")} className={cn(err("areaSqm") && "border-bad")} placeholder="55" />
          </Field>
          <Field label={d.fields.market} htmlFor="mk">
            <Select id="mk" name="market" defaultValue="secondary">
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {dict.enums.market[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={d.fields.rooms} htmlFor="rooms" optional={dict.common.optional}>
            <Input id="rooms" name="rooms" inputMode="numeric" />
          </Field>
          <Field label={d.fields.floor} htmlFor="fl" optional={dict.common.optional}>
            <Input id="fl" name="floor" inputMode="numeric" />
          </Field>
          <Field label={d.fields.floorsTotal} htmlFor="fls" optional={dict.common.optional}>
            <Input id="fls" name="floorsTotal" inputMode="numeric" />
          </Field>
          <Field label={d.fields.yearBuilt} htmlFor="yr" optional={dict.common.optional}>
            <Input id="yr" name="yearBuilt" inputMode="numeric" placeholder="1985" />
          </Field>
          <Field label={d.fields.condition} htmlFor="cond" optional={dict.common.optional}>
            <Select id="cond" name="condition" defaultValue="">
              <option value="">—</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {dict.enums.condition[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={d.fields.buildingType} htmlFor="bt" optional={dict.common.optional}>
            <Select id="bt" name="buildingType" defaultValue="">
              <option value="">—</option>
              {BUILDING_TYPES.map((c) => (
                <option key={c} value={c}>
                  {dict.enums.buildingType[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-5 text-xs text-ink2">{d.hints.moreIsBetter}</p>
        <label className="mt-4 flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={useBrief} onChange={(e) => setUseBrief(e.target.checked)} />
          {d.useBrief}
        </label>
      </Card>

      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-xs text-ink2">{d.demoNote}</p>

      {errors.length > 0 && (
        <p role="alert" className="text-sm text-bad">
          {f(d.invalid, { fields: errors.map((k) => (k === "askingPrice" ? d.fields.askingPriceShort : k === "areaSqm" ? d.fields.area : k)).join(", ") })}
        </p>
      )}
      <Button type="submit" className="px-8 py-3 text-base">
        {d.submit} →
      </Button>
    </form>
  );
}
