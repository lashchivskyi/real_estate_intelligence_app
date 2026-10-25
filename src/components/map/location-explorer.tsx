"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { ESSENTIALS, type Essential, type NearbyPlace } from "@/domain/location/geo";
import type { LngLat } from "@/domain/location/types";
import { cn } from "@/lib/cn";
import { motion } from "../motion";
import { useI18n } from "../providers";
import { ProvenanceBadge } from "../ui/provenance";
import { EssentialIcon } from "./essential-icons";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full min-h-[380px] w-full animate-pulse bg-surface2" />,
});

type Filter = "all" | Essential;
const PREVIEW = 3;

/**
 * Map-first location explorer: a large map with every nearby place, a filter strip with the
 * nearest distance per category, and a grouped, named list (all shops, all clinics incl. private ones…).
 * Hovering a row highlights its marker and draws a line from the property; hovering a marker
 * highlights the row.
 */
export function LocationExplorer({
  subject,
  places,
  loading,
  comps,
  pois,
  className,
}: {
  subject: { point: LngLat; precise: boolean };
  places: NearbyPlace[];
  loading?: boolean;
  comps?: Array<{ point: LngLat; weight: number }>;
  pois?: Array<{ point: LngLat }>;
  className?: string;
}) {
  const { dict, lang, num } = useI18n();
  const d = dict.nearby;
  const [filter, setFilter] = useState<Filter>("all");
  const [hl, setHl] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pick = (f: Filter) => {
    setFilter(f);
    setSel(null);
  };
  const select = (i: number) => {
    setSel(i);
    // bring the row into view when the marker was clicked
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  const [expanded, setExpanded] = useState<Partial<Record<Essential, boolean>>>({});
  const unit = lang === "uk" ? { m: "м", km: "км" } : { m: "m", km: "km" };
  const dist = (m: number) => (m < 1000 ? `${m} ${unit.m}` : `${num(m / 1000, 1)} ${unit.km}`);

  const byCat = useMemo(() => {
    const g = {} as Record<Essential, NearbyPlace[]>;
    for (const c of ESSENTIALS) g[c] = places.filter((p) => p.cat === c).sort((a, b) => a.m - b.m);
    return g;
  }, [places]);
  const visible = useMemo(() => (filter === "all" ? places : byCat[filter]), [filter, places, byCat]);
  const idx = (p: NearbyPlace) => visible.indexOf(p);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {/* filter strip: nearest per category at a glance */}
      <div className="flex gap-2 overflow-x-auto border-b border-line p-3" role="tablist" aria-label={d.title}>
        <Chip active={filter === "all"} onClick={() => pick("all")}>
          {d.all} <span className="num text-ink2">{places.length}</span>
        </Chip>
        {ESSENTIALS.map((c) => {
          const near = byCat[c][0];
          return (
            <Chip key={c} active={filter === c} onClick={() => pick(c)} disabled={!near && !loading}>
              <EssentialIcon cat={c} size={15} />
              <span>{d.cats[c]}</span>
              <span className="num text-ink2">{loading ? "…" : near ? dist(near.m) : "—"}</span>
            </Chip>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[380px] sm:h-[460px] lg:h-[560px]">
          <MapView
            className="h-full w-full"
            center={subject.point}
            zoom={15}
            subject={subject}
            comps={comps}
            pois={pois}
            places={visible}
            highlight={hl}
            onPlaceHover={setHl}
            selected={sel}
            onSelect={select}
            fitKey={filter}
            failText={dict.report.location.mapFail}
            label={d.mapLabel}
          />
          <AnimatePresence>
            {(hl ?? sel) !== null && visible[(hl ?? sel) as number] && (
              <motion.div
                key={hl ?? sel}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="pointer-events-none absolute left-4 right-14 top-4 flex items-center gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-card backdrop-blur sm:right-auto sm:max-w-sm"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-brandink">
                  <EssentialIcon cat={visible[(hl ?? sel) as number].cat} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{visible[(hl ?? sel) as number].name ?? d.cats[visible[(hl ?? sel) as number].cat]}</span>
                  <span className="num block text-xs text-ink2">
                    {dist(visible[(hl ?? sel) as number].m)} · ≈ {visible[(hl ?? sel) as number].walkMin} {d.min}
                    {visible[(hl ?? sel) as number].address ? ` · ${visible[(hl ?? sel) as number].address}` : ""}
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* grouped list */}
        <div ref={listRef} className="max-h-[560px] overflow-y-auto border-t border-line lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
            <p className="text-sm font-semibold">{d.title}</p>
            <ProvenanceBadge kind="FACT" />
          </div>
          {loading && <p className="p-4 text-sm text-ink2">{d.loading}</p>}
          {!loading && places.length === 0 && <p className="p-4 text-sm text-ink2">{d.unavailable}</p>}
          {(filter === "all" ? ESSENTIALS : [filter]).map((c) => {
            const list = byCat[c];
            if (!list.length) return null;
            const open = expanded[c] || filter !== "all";
            const shown = open ? list : list.slice(0, PREVIEW);
            return (
              <section key={c} className="border-b border-line/70 px-2 py-2 last:border-0">
                <h3 className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink2">
                  <EssentialIcon cat={c} size={14} />
                  {d.cats[c]}
                  <span className="num ml-auto font-normal normal-case tracking-normal">{list.length}</span>
                </h3>
                <ul>
                  {shown.map((p) => {
                    const i = idx(p);
                    return (
                      <li key={`${p.point[0]}-${p.point[1]}`} data-i={i}>
                        <button
                          type="button"
                          onClick={() => select(i)}
                          aria-pressed={sel === i}
                          onMouseEnter={() => setHl(i)}
                          onMouseLeave={() => setHl(null)}
                          onFocus={() => setHl(i)}
                          onBlur={() => setHl(null)}
                          className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors", sel === i ? "bg-brand/15 ring-1 ring-brand/40" : hl === i ? "bg-brand/10" : "hover:bg-surface2")}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{p.name ?? d.unnamed}</span>
                            {p.address && <span className="block truncate text-xs text-ink2">{p.address}</span>}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="num block text-sm font-semibold">{dist(p.m)}</span>
                            <span className="num block text-[11px] text-ink2">≈ {p.walkMin} {d.min}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {filter === "all" && list.length > PREVIEW && (
                  <button type="button" onClick={() => setExpanded((e) => ({ ...e, [c]: !e[c] }))} className="mx-2 mb-1 mt-0.5 text-xs font-semibold text-brand hover:underline">
                    {open ? d.showLess : d.showAll.replace("{n}", String(list.length))}
                  </button>
                )}
              </section>
            );
          })}
          <p className="px-4 pb-4 pt-2 text-[11px] text-ink2">{d.note}</p>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, children, disabled, onClick }: { active: boolean; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-40",
        active ? "border-ink bg-ink text-bg [&_.text-ink2]:text-bg/70" : "border-line bg-surface hover:border-ink2",
      )}
    >
      {children}
    </button>
  );
}
