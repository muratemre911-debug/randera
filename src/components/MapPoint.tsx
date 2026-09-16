"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TURKEY_CENTER, TURKEY_ZOOM } from "@/lib/provinceCoords";

interface MapPointProps {
  lat: number | null;
  lng: number | null;
  /** Verilirse pin sürüklenebilir ve haritaya tıklayınca konum değişir. */
  onChange?: (lat: number, lng: number) => void;
  /** Pin yoksa haritanın açılacağı yer (ör. seçilen il merkezi). */
  center?: [number, number] | null;
  centerZoom?: number;
  zoom?: number;
  heightClass?: string;
  pinLabel?: string;
  className?: string;
}

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

function pinHtml(label: string) {
  return `
    <div style="transform: translate(-50%, -100%)" class="relative flex flex-col items-center">
      <div class="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold shadow-md whitespace-nowrap">${label}</div>
      <div class="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-indigo-600"></div>
    </div>`;
}

export default function MapPoint({
  lat,
  lng,
  onChange,
  center = null,
  centerZoom = 12,
  zoom = 15,
  heightClass = "h-72",
  pinLabel = "İşletmem",
  className = "",
}: MapPointProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const changeRef = useRef(onChange);

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || mapRef.current || !containerRef.current) return;

      const editable = Boolean(changeRef.current);
      const hasPoint = lat != null && lng != null;
      const start: [number, number] = hasPoint
        ? [lat, lng]
        : (center ?? TURKEY_CENTER);

      const map = L.map(containerRef.current, {
        center: start,
        zoom: hasPoint ? zoom : center ? centerZoom : TURKEY_ZOOM,
        zoomControl: true,
        minZoom: 5,
        maxZoom: 18,
      });

      L.tileLayer(OSM_TILES, {
        maxZoom: 19,
        attribution: OSM_ATTRIBUTION,
      }).addTo(map);
      mapRef.current = map;

      if (lat != null && lng != null) {
        markerRef.current = L.marker(start, {
          draggable: editable,
          icon: L.divIcon({
            className: "",
            html: pinHtml(pinLabel),
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          autoPan: true,
        }).addTo(map);
      }

      if (editable) {
        const place = (plat: number, plng: number) => {
          if (!markerRef.current) {
            markerRef.current = L.marker([plat, plng], {
              draggable: true,
              icon: L.divIcon({
                className: "",
                html: pinHtml(pinLabel),
                iconSize: [0, 0],
                iconAnchor: [0, 0],
              }),
              autoPan: true,
            }).addTo(map);
            markerRef.current.on("dragend", () => {
              const p = markerRef.current!.getLatLng();
              changeRef.current?.(p.lat, p.lng);
            });
          } else {
            markerRef.current.setLatLng([plat, plng]);
          }
        };

        map.on("click", (e) => {
          place(e.latlng.lat, e.latlng.lng);
          changeRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }

      setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pin yokken seçilen il/ilçe değişirse haritayı oraya taşı
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat != null || !center) return;
    map.setView(center, centerZoom);
  }, [center, centerZoom, lat]);

  // Dışarıdan gelen konum değişikliklerini (adresten bul, kayıt sonrası) yansıt
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || lat == null || lng == null) return;

    if (!marker) return; // pin yoksa haritayı ilk kurulumda konumlandır
    const current = marker.getLatLng();
    if (
      Math.abs(current.lat - lat) < 1e-6 &&
      Math.abs(current.lng - lng) < 1e-6
    )
      return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 z-0 ${className}`}
    />
  );
}
