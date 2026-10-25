"use client";

import { useEffect, useRef, useState } from "react";
import type { LngLat } from "@/domain/location/types";
import { essentialSvg } from "./essential-icons";
import type { MapViewProps } from "./map-view";

/**
 * Google Maps implementation of MapView. Used only when NEXT_PUBLIC_GOOGLE_MAPS_KEY is set — required
 * when Google Places data is displayed (Google Maps Platform terms). Same behaviour as the MapLibre view:
 * subject + halo, comps, essentials as icon markers, hover/select highlight, dashed link, fit-to-selection.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the Maps JS API is loaded at runtime without bundled types */
type G = any;

let loader: Promise<G> | null = null;
function loadGoogle(lang: string): Promise<G> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps?.Map) return resolve(w.google);
    w.__vdGmaps = () => resolve(w.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&v=weekly&loading=async&libraries=marker&language=${lang}&callback=__vdGmaps`;
    s.async = true;
    s.onerror = () => reject(new Error("google-maps-load"));
    document.head.appendChild(s);
  });
  return loader;
}

const ll = (p: LngLat) => ({ lat: p[1], lng: p[0] });

export function GoogleMapView({ center, zoom = 13, subject, comps = [], places = [], highlight = null, onPlaceHover, selected = null, onSelect, fitKey, className, failText, label }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const g = useRef<{ api: G; map: G } | null>(null);
  const placeMarkers = useRef<G[]>([]);
  const layer = useRef<G[]>([]);
  const link = useRef<G>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onPlaceHover, onSelect });
  useEffect(() => {
    cb.current = { onPlaceHover, onSelect };
  }, [onPlaceHover, onSelect]);

  useEffect(() => {
    let cancelled = false;
    loadGoogle(document.documentElement.lang || "uk")
      .then((api) => {
        if (cancelled || !ref.current) return;
        const map = new api.maps.Map(ref.current, {
          center: ll(center),
          zoom,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        g.current = { api, map };
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brand = () => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#2b45d4";

  // subject + comps
  useEffect(() => {
    if (!ready || !g.current) return;
    const { api, map } = g.current;
    layer.current.forEach((m) => (m.map = null));
    layer.current = [];
    const dot = (size: number, color: string, opacity = 1, border = "#fff") => {
      const el = document.createElement("div");
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${opacity};border:${border === "none" ? "0" : `2px solid ${border}`};transform:translateY(50%)`;
      return el;
    };
    for (const c of comps) layer.current.push(new api.maps.marker.AdvancedMarkerElement({ map, position: ll(c.point), content: dot(6 + c.weight * 8, brand(), 0.4) }));
    if (subject) {
      const halo = dot(subject.precise ? 40 : 90, brand(), 0.15, "none");
      layer.current.push(new api.maps.marker.AdvancedMarkerElement({ map, position: ll(subject.point), content: halo, zIndex: 1 }));
      layer.current.push(new api.maps.marker.AdvancedMarkerElement({ map, position: ll(subject.point), content: dot(16, brand(), 1), zIndex: 3 }));
      map.panTo(ll(subject.point));
    }
  }, [ready, comps, subject]);

  // essentials
  useEffect(() => {
    if (!ready || !g.current) return;
    const { api, map } = g.current;
    placeMarkers.current.forEach((m) => (m.map = null));
    placeMarkers.current = places.map((p, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "vd-place";
      el.innerHTML = essentialSvg(p.cat, 15);
      el.addEventListener("mouseenter", () => cb.current.onPlaceHover?.(i));
      el.addEventListener("mouseleave", () => cb.current.onPlaceHover?.(null));
      const mk = new api.maps.marker.AdvancedMarkerElement({ map, position: ll(p.point), content: el, title: p.name ?? "", zIndex: 2 });
      mk.addListener("click", () => cb.current.onSelect?.(i));
      return mk;
    });
  }, [ready, places]);

  // highlight + link
  useEffect(() => {
    if (!ready || !g.current) return;
    const { api, map } = g.current;
    placeMarkers.current.forEach((m, i) => (m.content.dataset.active = String(i === highlight || i === selected)));
    link.current?.setMap(null);
    const hi = highlight ?? selected;
    const h = hi !== null ? places[hi] : null;
    if (h && subject) {
      link.current = new api.maps.Polyline({
        map,
        path: [ll(subject.point), ll(h.point)],
        strokeOpacity: 0,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: brand(), scale: 2 }, offset: "0", repeat: "10px" }],
      });
    }
  }, [ready, places, highlight, selected, subject]);

  const fit = (pts: LngLat[], maxZoom: number) => {
    if (!g.current || pts.length === 0) return;
    const { api, map } = g.current;
    const b = new api.maps.LatLngBounds();
    pts.forEach((p) => b.extend(ll(p)));
    map.fitBounds(b, 80);
    api.maps.event.addListenerOnce(map, "idle", () => map.getZoom() > maxZoom && map.setZoom(maxZoom));
  };
  useEffect(() => {
    if (!ready || selected === null || !places[selected]) return;
    fit([places[selected].point, ...(subject ? [subject.point] : [])], 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected]);
  useEffect(() => {
    if (!ready || !fitKey || places.length === 0) return;
    fit([...places.map((p) => p.point), ...(subject ? [subject.point] : [])], 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  if (failed) return <div className={`grid place-items-center bg-surface2 p-6 text-center text-sm text-ink2 ${className ?? ""}`}>{failText}</div>;
  return <div ref={ref} className={className} role="region" aria-label={label} />;
}
