"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { NearbyPlace } from "@/domain/location/geo";
import type { LngLat } from "@/domain/location/types";
import { essentialSvg } from "./essential-icons";
import { GoogleMapView } from "./map-google";

setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

/**
 * MapLibre on OpenFreeMap vector tiles (no key, OSM data — compatible with our OSM-based geocoding/POIs).
 * Google Places data could not be shown on this map (Google ToS requires a Google map), see docs/data-sources.md.
 */
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

export interface MapViewProps {
  center: LngLat;
  zoom?: number;
  /** The property. `precise` = geocoded building; otherwise drawn with a wide uncertainty halo. */
  subject?: { point: LngLat; precise: boolean } | null;
  comps?: Array<{ point: LngLat; weight: number }>;
  pois?: Array<{ point: LngLat }>;
  places?: NearbyPlace[];
  highlight?: number | null;
  onPlaceHover?: (i: number | null) => void;
  /** Clicked place: the map zooms so both the property and the place are visible. */
  selected?: number | null;
  onSelect?: (i: number) => void;
  /** Changing this key fits the map to the property + all places (e.g. after a category filter). */
  fitKey?: string;
  className?: string;
  failText: string;
  label: string;
}

export const boundsOf = (pts: LngLat[]): [[number, number], [number, number]] => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
};

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const pt = (p: LngLat, props: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: p } });

/** Google Maps when its browser key is configured (required by Google's terms for Places data), else MapLibre. */
export function MapView(props: MapViewProps) {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? <GoogleMapView {...props} /> : <MapLibreView {...props} />;
}

function MapLibreView({ center, zoom = 13, subject, comps = [], pois = [], places = [], highlight = null, onPlaceHover, selected = null, onSelect, fitKey, className, failText, label }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hoverRef = useRef(onPlaceHover);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    hoverRef.current = onPlaceHover;
    selectRef.current = onSelect;
  }, [onPlaceHover, onSelect]);

  // create once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({ container: el, style: dark ? STYLE_DARK : STYLE_LIGHT, center, zoom, attributionControl: { compact: true }, cooperativeGestures: true });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL unavailable
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e) => {
      if (!map.loaded() && /style|fetch|network/i.test(String(e.error?.message))) setFailed(true);
    });
    const css = getComputedStyle(document.documentElement);
    const brand = css.getPropertyValue("--brand").trim() || "#2b45d4";
    const ink = css.getPropertyValue("--ink").trim() || "#12151b";
    map.on("load", () => {
      map.addSource("comps", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "comps", type: "circle", source: "comps", paint: { "circle-color": brand, "circle-opacity": 0.35, "circle-radius": ["interpolate", ["linear"], ["get", "w"], 0, 3, 1, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
      map.addSource("pois", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "pois", type: "circle", source: "pois", paint: { "circle-color": ink, "circle-opacity": 0.4, "circle-radius": 2.5 } });
      map.addSource("link", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "link", type: "line", source: "link", paint: { "line-color": brand, "line-width": 2, "line-dasharray": [2, 2] } });
      map.addSource("subject", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "halo", type: "circle", source: "subject", paint: { "circle-color": brand, "circle-opacity": 0.12, "circle-radius": ["case", ["get", "precise"], 22, 48], "circle-stroke-color": brand, "circle-stroke-width": 1, "circle-stroke-opacity": 0.5 } });
      map.addLayer({ id: "subject", type: "circle", source: "subject", paint: { "circle-color": brand, "circle-radius": 8, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      setReady(true);
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // data layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("comps") as GeoJSONSource).setData(fc(comps.map((c) => pt(c.point, { w: c.weight }))));
    (map.getSource("pois") as GeoJSONSource).setData(fc(pois.map((p) => pt(p.point))));
    (map.getSource("subject") as GeoJSONSource).setData(fc(subject ? [pt(subject.point, { precise: subject.precise })] : []));
  }, [ready, comps, pois, subject]);

  // fly to the subject only when its position actually changes (not on every re-render)
  const subjectKey = subject ? `${subject.point[0]},${subject.point[1]},${subject.precise}` : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !subjectKey) return;
    const [lng, lat, precise] = subjectKey.split(",");
    map.flyTo({ center: [Number(lng), Number(lat)], zoom: precise === "true" ? 15.2 : Math.max(zoom, 13), speed: 1.2, essential: true });
  }, [ready, subjectKey, zoom]);

  // essentials as HTML markers (icon chips)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = places.map((p, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${p.name ?? p.cat} · ${p.m} m`);
      el.className = "vd-place";
      el.innerHTML = essentialSvg(p.cat, 15);
      el.addEventListener("mouseenter", () => hoverRef.current?.(i));
      el.addEventListener("mouseleave", () => hoverRef.current?.(null));
      el.addEventListener("focus", () => hoverRef.current?.(i));
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectRef.current?.(i);
      });
      return new Marker({ element: el }).setLngLat(p.point).addTo(map);
    });
  }, [ready, places]);

  // highlight + dashed link line from the subject to the highlighted place
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m, i) => (m.getElement().dataset.active = String(i === highlight || i === selected)));
    const hi = highlight ?? selected;
    const h = hi !== null ? places[hi] : null;
    (map.getSource("link") as GeoJSONSource).setData(
      fc(h && subject ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [subject.point, h.point] } }] : []),
    );
  }, [ready, places, highlight, selected, subject]);

  // zoom to the selected place (+ the property) so both are visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || selected === null || !places[selected]) return;
    const pts = [places[selected].point, ...(subject ? [subject.point] : [])];
    map.fitBounds(boundsOf(pts), { padding: { top: 90, bottom: 70, left: 70, right: 70 }, maxZoom: 17.2, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected]);

  // fit everything on demand (filter change)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fitKey || places.length === 0) return;
    const pts = [...places.map((p) => p.point), ...(subject ? [subject.point] : [])];
    map.fitBounds(boundsOf(pts), { padding: 60, maxZoom: 16.5, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  if (failed) return <div className={`grid place-items-center bg-surface2 p-6 text-center text-sm text-ink2 ${className ?? ""}`}>{failText}</div>;
  return <div ref={ref} className={className} role="region" aria-label={label} />;
}
