'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Compass, MapPin, Star, X, ChevronRight } from 'lucide-react';

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
}

interface DiscoverMapProps {
  tenants: TenantWithDetails[];
  selectedTenant: TenantWithDetails | null;
  onSelectTenant: (tenant: TenantWithDetails | null) => void;
  getTenantPrice: (tenant: TenantWithDetails) => number;
  getTenantRating: (tenant: TenantWithDetails) => { score: string; reviews: number; hasReviews?: boolean };
  getSectorLabel: (sector: string | null) => string;
  getCoverImage: (tenant: TenantWithDetails) => string;
  lang: string;
}

// Approximate geo-coordinates for Turkish provinces
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "İstanbul": { lat: 41.0082, lng: 28.9784 },
  "Ankara": { lat: 39.9334, lng: 32.8597 },
  "İzmir": { lat: 38.4237, lng: 27.1428 },
  "Bursa": { lat: 40.1885, lng: 29.0610 },
  "Antalya": { lat: 36.8969, lng: 30.7133 },
  "Adana": { lat: 37.0000, lng: 35.3213 },
  "Konya": { lat: 37.8746, lng: 32.4932 },
  "Gaziantep": { lat: 37.0662, lng: 37.3833 },
  "Eskişehir": { lat: 39.7767, lng: 30.5206 },
  "Trabzon": { lat: 41.0027, lng: 39.7168 },
  "Muğla": { lat: 37.2153, lng: 28.3636 },
  "Samsun": { lat: 41.2867, lng: 36.3300 },
  "Kayseri": { lat: 38.7312, lng: 35.4787 },
  "Mersin": { lat: 36.8121, lng: 34.6415 },
  "Diyarbakır": { lat: 37.9144, lng: 40.2306 },
  "Kocaeli": { lat: 40.7654, lng: 29.9408 },
  "Aydın": { lat: 37.8444, lng: 27.8458 },
  "Tekirdağ": { lat: 40.9781, lng: 27.5117 },
  "Balıkesir": { lat: 39.6484, lng: 27.8826 },
  "Denizli": { lat: 37.7765, lng: 29.0864 },
  "Sakarya": { lat: 40.7569, lng: 30.3783 },
  "Manisa": { lat: 38.6191, lng: 27.4289 },
  "Hatay": { lat: 36.4018, lng: 36.3498 },
  "Şanlıurfa": { lat: 37.1674, lng: 38.7955 },
  "Malatya": { lat: 38.3552, lng: 38.3095 },
  "Erzurum": { lat: 39.9043, lng: 41.2679 },
  "Van": { lat: 38.4891, lng: 43.4089 },
  "Çanakkale": { lat: 40.1553, lng: 26.4142 },
};

// Turkey bounding box for projection
const BOUNDS = {
  minLat: 35.8,
  maxLat: 42.2,
  minLng: 25.8,
  maxLng: 44.8,
};

export default function DiscoverMap({
  tenants,
  selectedTenant,
  onSelectTenant,
  getTenantPrice,
  getTenantRating,
  getSectorLabel,
  getCoverImage,
  lang,
}: DiscoverMapProps) {
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStart.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Map pin coordinate projector
  const projectedTenants = useMemo(() => {
    return tenants.map((tenant, idx) => {
      let coords = tenant.province ? CITY_COORDS[tenant.province] : null;

      if (!coords) {
        // Deterministic hash based coords fallback
        const hash = tenant.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        coords = {
          lat: 38.0 + ((hash % 100) / 100) * 3.5,
          lng: 28.0 + (((hash * 7) % 100) / 100) * 14.0,
        };
      }

      // Add a slight jitter if multiple tenants share city
      const jitterX = ((idx % 5) - 2) * 1.6;
      const jitterY = (((idx * 3) % 5) - 2) * 1.6;

      // Project into percentage coordinates [0, 100]
      const rawX = ((coords.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
      // Invert Y because latitude increases northward, but SVG/screen Y increases downward
      const rawY = (1 - (coords.lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;

      return {
        tenant,
        x: Math.min(Math.max(rawX + jitterX, 5), 95),
        y: Math.min(Math.max(rawY + jitterY, 8), 92),
      };
    });
  }, [tenants]);

  return (
    <div
      className="relative w-full h-[480px] sm:h-[580px] rounded-3xl overflow-hidden select-none cursor-grab active:cursor-grabbing border border-slate-200/80 dark:border-slate-800/80 bg-[#f4f3f0] dark:bg-[#12141c] shadow-sm transition-colors"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Apple Maps Style Vector Canvas */}
      <div
        className="absolute inset-0 transition-transform duration-75 origin-center pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Apple Maps Grid & Terrain Textures */}
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="apple-maps-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.75"
                className="text-slate-300/40 dark:text-slate-800/40"
              />
            </pattern>
            <linearGradient id="water-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.4" className="dark:stop-color-[#0f172a]" />
              <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.6" className="dark:stop-color-[#1e293b]" />
            </linearGradient>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#apple-maps-grid)" />

          {/* Stylized Coastal Water Curves (Marmara / Aegean / Mediterranean / Black Sea) */}
          <path
            d="M 0 0 Q 300 80 600 20 T 1200 40 L 1200 0 Z"
            fill="url(#water-gradient)"
          />
          <path
            d="M 0 350 Q 80 500 200 600 L 0 600 Z"
            fill="url(#water-gradient)"
          />
          <path
            d="M 300 600 Q 600 520 900 600 L 900 600 Z"
            fill="url(#water-gradient)"
          />

          {/* Major arterial road vector lines */}
          <path
            d="M 120 180 Q 320 220 500 260 T 900 320"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            className="text-amber-500/25 dark:text-amber-400/20"
          />
          <path
            d="M 500 260 Q 520 380 560 480"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-indigo-400/25 dark:text-indigo-500/20"
          />
          <path
            d="M 180 320 Q 300 380 480 440"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="text-slate-400/20 dark:text-slate-700/30"
          />
        </svg>

        {/* Interactive Price Pill Pins (Airbnb & Apple Maps Style) */}
        <div className="absolute inset-0 pointer-events-auto">
          {projectedTenants.map(({ tenant, x, y }) => {
            const isSelected = selectedTenant?.id === tenant.id;
            const price = getTenantPrice(tenant);

            return (
              <div
                key={tenant.id}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute transition-transform duration-200 z-10 ${
                  isSelected ? 'z-30 scale-110' : 'hover:scale-105'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTenant(tenant);
                  }}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/40 ring-4 ring-indigo-500/25'
                      : 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg'
                  }`}
                >
                  <span className="text-[11px]">₺{price}</span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  )}
                </button>

                {/* Needle / Pin Tail */}
                <div
                  className={`w-0 h-0 mx-auto border-x-4 border-x-transparent border-t-4 transition-colors ${
                    isSelected
                      ? 'border-t-indigo-600'
                      : 'border-t-white/95 dark:border-t-slate-900/95'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Map Controls (Apple Maps Style Floating Glass) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <div className="flex flex-col rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800 shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => Math.min(z + 0.25, 2.2));
            }}
            className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
            title="Yakınlaştır"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
          <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => Math.max(z - 0.25, 0.75));
            }}
            className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
            title="Uzaklaştır"
          >
            <Minus size={18} strokeWidth={2.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetView();
          }}
          className="p-2.5 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
          title="Merkeze Sıfırla"
        >
          <Compass size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Map Header Status Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800 shadow-md text-xs font-semibold text-slate-700 dark:text-slate-200">
          <MapPin size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span>
            {tenants.length} {lang === 'tr' ? 'işletme haritada' : 'businesses on map'}
          </span>
        </div>
      </div>

      {/* Floating Bottom Preview Card (Airbnb / Apple Maps Style) */}
      {selectedTenant && (
        <div className="absolute bottom-4 inset-x-4 max-w-sm sm:max-w-md mx-auto z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                <span>Müsait</span>
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
                  {[selectedTenant.district, selectedTenant.province].filter(Boolean).join(', ') || 'Konum belirtilmedi'}
                </span>
              </p>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  ₺{getTenantPrice(selectedTenant)}
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1">
                    {lang === 'tr' ? '\'den başlayan' : 'starting'}
                  </span>
                </span>

                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>{lang === 'tr' ? 'Randevu Al' : 'Book'}</span>
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
              title="Kapat"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
