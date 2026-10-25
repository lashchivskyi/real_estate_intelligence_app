"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import type { AddressSuggestion } from "@/domain/location/geo";
import { cn } from "@/lib/cn";
import { motion } from "../motion";
import { useI18n } from "../providers";

/**
 * Address type-ahead (WAI-ARIA combobox): debounced 250 ms, aborts stale requests,
 * keyboard ↑/↓/Enter/Esc, shows street + house number matches available in the chosen city.
 */
export function AddressAutocomplete({
  cityId,
  value,
  onChange,
  onSelect,
  id,
  name,
}: {
  cityId: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  id: string;
  name?: string;
}) {
  const { dict } = useI18n();
  const d = dict.nearby;
  const listId = useId();
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const skip = useRef(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear results for short input
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/suggest?q=${encodeURIComponent(q)}&city=${cityId}`, { signal: c.signal });
        const j = (await res.json()) as { items: AddressSuggestion[] };
        setItems(j.items ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted or offline */
      } finally {
        if (ctrl.current === c) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, cityId]);

  const pick = (s: AddressSuggestion) => {
    skip.current = true;
    onChange(s.street ? `${s.street}${s.housenumber ? `, ${s.housenumber}` : ""}` : s.label);
    onSelect(s);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <input
          id={id}
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={d.placeholder}
          className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-9 text-[15px] text-ink placeholder:text-ink2/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          maxLength={200}
        />
        {loading && <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-card"
          >
            {items.length === 0 && !loading && <li className="px-3 py-2.5 text-sm text-ink2">{d.noMatches}</li>}
            {items.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-sm", i === active && "bg-surface2")}
              >
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", s.precise ? "bg-brand" : "border border-ink2")} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {s.street ?? s.label.split(" — ")[0]}
                    {s.housenumber && <span className="num ml-1.5 rounded bg-surface2 px-1.5 py-0.5 text-xs">{s.housenumber}</span>}
                  </span>
                  <span className="block truncate text-xs text-ink2">{s.label.split(" — ")[1] ?? s.city}</span>
                </span>
                {!s.precise && <span className="ml-auto shrink-0 text-[11px] text-ink2">{d.streetOnly}</span>}
              </li>
            ))}
            <li className="px-3 pb-1 pt-1.5 text-[10px] text-ink2">© OpenStreetMap · Photon</li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
