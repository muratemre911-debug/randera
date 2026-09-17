"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Minus,
  Compass,
  MapPin,
  Star,
  X,
  ChevronRight,
  Building2,
} from "lucide-react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  tenantCoords,
  hasExactLocation,
  TURKEY_CENTER,
  TURKEY_ZOOM,
} from "@/lib/provinceCoords";
import { preventMapFocusScroll } from "@/lib/preventMapFocusScroll";

export interface TenantWithDetails {
  id: string;
  name: string;
  sector: string | null;
  province: string | null;
  district: string | null;
  slug: string;
  profile_image_url: string | null;
  cover_image_url?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  building_no?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface DiscoverMapProps {
  tenants: TenantWithDetails[];
  selectedTenant: TenantWithDetails | null;
  onSelectTenant: (tenant: TenantWithDetails | null) => void;
  getTenantPrice: (tenant: TenantWithDetails) => number | null;
  getTenantRating: (tenant: TenantWithDetails) => {
    score: string;
    reviews: number;
    hasReviews?: boolean;
  };
  getSectorLabel: (sector: string | null) => string;
  getCoverImage: (tenant: TenantWithDetails) => string;
  lang: string;
}

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

function pinHtml(price: number | null, isSelected: boolean, name: string) {
  // Fiyatı olmayan işletmenin pininde isim gösterilir (uydurma fiyat yazılmaz)
  const label =
    price != null
      ? `₺${price}`
      : `${name.length > 14 ? `${name.slice(0, 14)}…` : name}`;

  return `
    <div style="transform: translate(-50%, -100%)" class="relative">
      <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs shadow-md border whitespace-nowrap transition-all ${
        isSelected
          ? "bg-indigo-600 text-white border-indigo-500 ring-4 ring-indigo-500/25"
          : "bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700 hover:border-indigo-400"
      }">
        <span class="text-[11px]">${label}</span>
        ${isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>' : ""}
      </button>
      <div class="w-0 h-0 mx-auto border-x-4 border-x-transparent border-t-4 ${
        isSelected
          ? "border-t-indigo-600"
          : "border-t-white/95 dark:border-t-slate-900/95"
      }"></div>
    </div>`;
}

export default function DiscoverMap({
  tenants,
  selectedTenant: selectedTenantProp,
  onSelectTenant,
  getTenantPrice,
  getTenantRating,
  getSectorLabel,
  getCoverImage,
  lang,
}: DiscoverMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const selectRef = useRef(onSelectTenant);
  const [ready, setReady] = useState(false);

  // Filtre değişip listeden çıkan işletmenin pin/kartı gösterilmesin
  const selectedTenant =
    tenants.find((t) => t.id === selectedTenantProp?.id) ?? null;
  const approximateCount = tenants.filter((t) => !hasExactLocation(t)).length;

  useEffect(() => {
    selectRef.current = onSelectTenant;
  }, [onSelectTenant]);

  // Harita örneğini bir kez kur (leaflet yalnızca tarayıcıda yüklenir)
  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: TURKEY_CENTER,
        zoom: TURKEY_ZOOM,
        zoomControl: false,
        minZoom: 5,
        maxZoom: 18,
      });

      L.tileLayer(OSM_TILES, {
        maxZoom: 19,
        attribution: OSM_ATTRIBUTION,
      }).addTo(map);

      // Harita/zoom kontrolüne dokununca sayfa kaymasın (Leaflet focus() verir)
      preventMapFocusScroll(map.getContainer());

      map.on("click", () => selectRef.current(null));

      leafletRef.current = L;
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
  }, []);

  // Pinleri (fiyat balonlarını) bas
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();

    tenants.forEach((tenant) => {
      const isSelected = selectedTenant?.id === tenant.id;
      const coords = tenantCoords(tenant);
      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: "",
          html: pinHtml(getTenantPrice(tenant), isSelected, tenant.name),
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: isSelected ? 1000 : 0,
        title: tenant.name,
      });

      marker.on("click", () => {
        selectRef.current(tenant);
        map.panTo(coords);
      });

      marker.addTo(layer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, selectedTenant, ready]);

  // Filtre değişince görünümü sonuçlara sığdır
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || tenants.length === 0) return;

    map.fitBounds(L.latLngBounds(tenants.map((t) => tenantCoords(t))), {
      padding: [70, 70],
      maxZoom: 12,
    });
  }, [tenants, ready]);

  const resetView = () => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (tenants.length > 0) {
      map.fitBounds(L.latLngBounds(tenants.map((t) => tenantCoords(t))), {
        padding: [70, 70],
        maxZoom: 12,
      });
    } else {
      map.setView(TURKEY_CENTER, TURKEY_ZOOM);
    }
  };

  return (
    <div data-no-swipe className="relative w-full h-[480px] sm:h-[580px] rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 shadow-sm bg-[#f4f3f0] dark:bg-[#12141c]">
      {/* Gerçek harita (Leaflet + OpenStreetMap) */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Map Controls (Apple Maps Style Floating Glass) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="flex flex-col rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800 shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
            title={lang === "tr" ? "Yakınlaştır" : "Zoom in"}
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
          <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
            title={lang === "tr" ? "Uzaklaştır" : "Zoom out"}
          >
            <Minus size={18} strokeWidth={2.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={resetView}
          className="p-2.5 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
          title={lang === "tr" ? "Sonuçlara Sığdır" : "Fit results"}
        >
          <Compass size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Map Header Status Badge */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800 shadow-md text-xs font-semibold text-slate-700 dark:text-slate-200">
          <MapPin size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span>
            {tenants.length}{" "}
            {lang === "tr" ? "işletme haritada" : "businesses on map"}
          </span>
        </div>
        {tenants.length > 0 && approximateCount > 0 && (
          <p className="mt-1.5 ml-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {lang === "tr"
              ? `${approximateCount} işletme konumunu henüz işaretlemedi (il merkezinde gösteriliyor)`
              : `${approximateCount} business(es) have no pinned location (shown at city center)`}
          </p>
        )}
      </div>

      {/* Boş sonuç */}
      {ready && tenants.length === 0 && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 max-w-xs mx-auto text-center px-5 py-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl">
          <Building2
            size={26}
            className="mx-auto mb-2 text-slate-300 dark:text-slate-700"
          />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {lang === "tr"
              ? "Haritada gösterilecek işletme yok"
              : "No businesses to show on map"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === "tr"
              ? "Filtreleri değiştirmeyi deneyin."
              : "Try changing your filters."}
          </p>
        </div>
      )}

      {/* Floating Bottom Preview Card (Airbnb / Apple Maps Style) */}
      {selectedTenant && (
        <div className="absolute bottom-4 inset-x-4 max-w-sm sm:max-w-md mx-auto z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div
            onClick={() => router.push(`/b/${selectedTenant.slug}`)}
            className="group relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-3xl p-3 sm:p-4 border border-slate-200/90 dark:border-slate-800 shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex gap-3.5 items-center"
          >
            {/* Thumbnail */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
              <img
                src={getCoverImage(selectedTenant)}
                alt={selectedTenant.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-white text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{lang === "tr" ? "Müsait" : "Open"}</span>
              </div>

              {/* Profil fotoğrafı */}
              <div className="absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm dark:border-slate-900 dark:bg-slate-800">
                {selectedTenant.profile_image_url ? (
                  <img
                    src={selectedTenant.profile_image_url}
                    alt={selectedTenant.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2
                    size={14}
                    className="text-indigo-600 dark:text-indigo-400"
                  />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold mb-0.5">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span>{getTenantRating(selectedTenant).score}</span>
                {getTenantRating(selectedTenant).hasReviews && (
                  <span className="text-slate-400 font-normal">
                    ({getTenantRating(selectedTenant).reviews})
                  </span>
                )}
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                  {getSectorLabel(selectedTenant.sector)}
                </span>
              </div>

              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {selectedTenant.name}
              </h4>

              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                <MapPin size={12} className="shrink-0 text-slate-400" />
                <span>
                  {[
                    selectedTenant.street,
                    selectedTenant.building_no,
                    selectedTenant.district,
                    selectedTenant.province,
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                    (lang === "tr" ? "Konum belirtilmedi" : "No location")}
                </span>
              </p>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {getTenantPrice(selectedTenant) != null ? (
                    <>
                      ₺{getTenantPrice(selectedTenant)}
                      <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1">
                        {lang === "tr" ? "'den başlayan" : "starting"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      {lang === "tr"
                        ? "Fiyat bilgisi yok"
                        : "Price not available"}
                    </span>
                  )}
                </span>

                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>{lang === "tr" ? "Randevu Al" : "Book"}</span>
                  <ChevronRight size={14} />
                </span>
              </div>
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTenant(null);
              }}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title={lang === "tr" ? "Kapat" : "Close"}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
