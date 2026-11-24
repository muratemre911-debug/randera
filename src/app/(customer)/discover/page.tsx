"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  Building2,
  MapPin,
  Search,
  ChevronRight,
  X,
  SlidersHorizontal,
  List,
  Map as MapIcon,
  Star,
  Heart,
  RotateCcw,
  Check,
} from "lucide-react";
import citiesData from "@/lib/cities.json";
import SafeImage from "@/components/SafeImage";
import { formatFullAddress } from "@/lib/address";
import { matchesPriceRange, parsePrice } from "@/lib/price";
import { isDiscoverable } from "@/lib/membership";
import { useFavorites } from "@/lib/useFavorites";
import DiscoverMap, {
  TenantWithDetails,
} from "@/components/discover/DiscoverMap";
import SegmentedControl from "@/components/ui/SegmentedControl";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { DiscoverSkeleton } from "@/components/Skeleton";
import Presence from "@/components/ui/Presence";

export const dynamic = "force-dynamic";

interface Sector {
  name: string;
  value: string;
}

/**
 * Bir işletmenin bugünkü müsaitlik durumu (sunucu tarafında hesaplanır).
 * `hasFreeSlot` false ise kartta "Bugün Müsait" rozeti GÖSTERİLMEZ — eskiden
 * rozet her kartta sabit basılıyordu ve kullanıcıya gerçek olmayan bilgi
 * veriyordu.
 */
interface Availability {
  isOpen: boolean;
  hasFreeSlot: boolean;
  nextSlot: string | null;
  reason: string;
}

// Curated high-res sector images for fallback
const SECTOR_IMAGES: Record<string, string> = {
  berber:
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
  kuafor:
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
  guzellik:
    "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
  spa: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
  klinik:
    "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
  dis: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
  dovme:
    "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80",
  default:
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80",
};

export default function DiscoverPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const { favoriteIds: favorites, toggleFavorite } = useFavorites();

  const [tenants, setTenants] = useState<TenantWithDetails[]>([]);
  const [tenantPrices, setTenantPrices] = useState<Record<string, number>>({});
  const [ratingSummary, setRatingSummary] = useState<
    Record<string, { average_rating: number | null; total_reviews: number }>
  >({});
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  /** İşletme id → bugünkü müsaitlik durumu. */
  const [availability, setAvailability] = useState<
    Record<string, Availability>
  >({});

  // View Mode: 'list' or 'map' (Apple Maps style segmented control)
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedMapTenant, setSelectedMapTenant] =
    useState<TenantWithDetails | null>(null);

  // Filters
  const [filterSector, setFilterSector] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  // Fiyat aralığı: elle girilen min/maks (ikisi de boşsa fiyat filtresi yok)
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filterAvailability, setFilterAvailability] = useState<"all" | "today">(
    "all",
  );
  const [search, setSearch] = useState("");

  // Bottom Sheet Filter Drawer state
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState("");

  const fetchData = async () => {
    try {
      // 1. İşletmeleri çek (konum/üyelik kolonları yoksa eski kolonlarla devam et)
      const COLS =
        "id, name, sector, province, district, neighborhood, street, building_no, slug, profile_image_url, cover_image_url, address";
      const attempts = [
        {
          cols: `${COLS}, latitude, longitude, membership_status, trial_ends_at, membership_ends_at`,
          activeOnly: true,
        },
        { cols: `${COLS}, latitude, longitude`, activeOnly: true },
        { cols: COLS, activeOnly: true },
        { cols: COLS, activeOnly: false },
      ];

      let discovered: TenantWithDetails[] = [];

      for (const attempt of attempts) {
        const query = supabase.from("tenants").select(attempt.cols);
        const { data, error } = await (attempt.activeOnly
          ? query.eq("is_active", true)
          : query);
        if (!error && data) {
          // SAFETY: select listesi dinamik olduğu için Supabase tip çıkarımı yapamıyor;
          // kolonlar COLS sabitinde tanımlı ve TenantWithDetails ile birebir eşleşiyor.
          const rows = data as unknown as (TenantWithDetails & {
            membership_status?: string | null;
            trial_ends_at?: string | null;
            membership_ends_at?: string | null;
          })[];
          // Üyeliği kapatılmış/süresi dolmuş işletmeler keşfette gösterilmez
          discovered = rows.filter((t) => isDiscoverable(t));
          setTenants(discovered);
          break;
        }
      }

      // 2. Fiyatları çek
      const { data: servicesData } = await supabase
        .from("services")
        .select("tenant_id, price")
        .eq("is_active", true);

      if (servicesData) {
        const priceMap: Record<string, number> = {};
        servicesData.forEach((s) => {
          if (!priceMap[s.tenant_id] || s.price < priceMap[s.tenant_id]) {
            priceMap[s.tenant_id] = s.price;
          }
        });
        setTenantPrices(priceMap);
      }

      // 3. Gerçek Değerlendirmeleri ve Puanları Çek
      try {
        const revRes = await fetch("/api/reviews?summary=true");
        const revData = await revRes.json();
        if (revData && !revData.error) {
          setRatingSummary(revData);
        }
      } catch (err) {
        console.error("Reviews summary fetch error:", err);
      }

      // 4. Sektörleri çek
      const sectorRes = await fetch("/api/admin/sectors");
      const sectorData = await sectorRes.json();
      if (Array.isArray(sectorData)) setSectors(sectorData as Sector[]);

      // 5. Gerçek müsaitlik bilgisi (bugün açık mı, boş slot var mı).
      //    Tek toplu istek — her işletme için ayrı istek atılmasın.
      if (discovered.length > 0) {
        try {
          const ids = discovered.map((t) => t.id).join(",");
          const availRes = await fetch(`/api/availability?ids=${ids}`);
          if (availRes.ok) {
            const availData = await availRes.json();
            if (availData && !availData.error) {
              setAvailability(availData as Record<string, Availability>);
            }
          }
        } catch (err) {
          console.error("Availability fetch error:", err);
        }
      }
    } catch (error) {
      console.error("Discover fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- veri çekme; setState çağrıları await sonrasında çalışır
    fetchData();
  }, []);

  // Fiyat: yalnızca gerçek hizmet fiyatı varsa gösterilir (uydurma fiyat yok)
  const getTenantPrice = (tenant: TenantWithDetails): number | null => {
    const price = tenantPrices[tenant.id];
    return price != null ? price : null;
  };

  // Puan hesaplama (Gerçek veritabanı değerlendirmeleri)
  const getTenantRating = (tenant: TenantWithDetails) => {
    const summary = ratingSummary[tenant.id];
    if (summary && summary.average_rating) {
      return {
        score: String(summary.average_rating),
        reviews: summary.total_reviews,
        hasReviews: true,
      };
    }
    return {
      score: lang === "tr" ? "Yeni" : "New",
      reviews: 0,
      hasReviews: false,
    };
  };

  // Kapak görseli çözümleme
  const getSectorImage = (tenant: TenantWithDetails) => {
    const sectorKey = tenant.sector?.toLowerCase() || "";
    for (const [key, img] of Object.entries(SECTOR_IMAGES)) {
      if (sectorKey.includes(key)) return img;
    }
    return SECTOR_IMAGES.default;
  };

  const getCoverImage = (tenant: TenantWithDetails) => {
    if (tenant.cover_image_url) return tenant.cover_image_url;
    if (tenant.profile_image_url) return tenant.profile_image_url;
    return getSectorImage(tenant);
  };

  // Sektör adını çöz
  const getSectorLabel = (value: string | null) => {
    if (!value) return lang === "tr" ? "Hizmet" : "Service";
    const normalized = value.trim().toLowerCase();
    const found = sectors.find(
      (s) =>
        s.value.trim().toLowerCase() === normalized ||
        s.name.trim().toLowerCase() === normalized,
    );
    if (found) return found.name;
    if (normalized === "other") return lang === "tr" ? "Diğer" : "Other";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const getSectorKey = (val: string | null) => {
    if (!val) return null;
    const normalized = val.trim().toLowerCase();
    const found = sectors.find(
      (s) =>
        s.value.trim().toLowerCase() === normalized ||
        s.name.trim().toLowerCase() === normalized,
    );
    return found ? found.value.trim().toLowerCase() : normalized;
  };

  // Kombine sektörler
  const combinedSectors = useMemo(() => {
    if (sectors.length > 0) return sectors;
    return Array.from(
      new Set(tenants.map((t) => t.sector).filter(Boolean)),
    ).map((sec) => ({
      value: sec as string,
      name: getSectorLabel(sec as string) || (sec as string),
    }));
  }, [sectors, tenants]);

  // Dinamik il/ilçe verileri
  const allProvinces = useMemo(() => Object.keys(citiesData), []);
  const filteredProvinces = useMemo(() => {
    if (!provinceSearch.trim()) return allProvinces;
    return allProvinces.filter((p) =>
      p.toLowerCase().includes(provinceSearch.toLowerCase().trim()),
    );
  }, [allProvinces, provinceSearch]);

  const uniqueDistricts = useMemo(() => {
    return filterProvince
      ? (citiesData as Record<string, string[]>)[filterProvince] || []
      : [];
  }, [filterProvince]);

  // Aktif filtre sayısı
  const activeFilterCount = useMemo(() => {
    return [
      Boolean(filterProvince),
      Boolean(filterDistrict),
      Boolean(filterSector),
      Boolean(minPrice || maxPrice),
      filterAvailability !== "all",
    ].filter(Boolean).length;
  }, [
    filterProvince,
    filterDistrict,
    filterSector,
    minPrice,
    maxPrice,
    filterAvailability,
  ]);

  // Filtreleri temizle
  const resetAllFilters = () => {
    setFilterSector("");
    setFilterProvince("");
    setFilterDistrict("");
    setMinPrice("");
    setMaxPrice("");
    setFilterAvailability("all");
    setSearch("");
  };

  // Filtrelenmiş işletmeler
  const filtered = useMemo(() => {
    const priceMin = parsePrice(minPrice);
    const priceMax = parsePrice(maxPrice);
    return tenants.filter((t) => {
      const matchSector =
        !filterSector || getSectorKey(t.sector) === getSectorKey(filterSector);
      const matchProvince = !filterProvince || t.province === filterProvince;
      const matchDistrict = !filterDistrict || t.district === filterDistrict;
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.sector ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (t.province ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (t.district ?? "").toLowerCase().includes(search.toLowerCase());

      // Fiyat filtresi (elle girilen min/maks):
      // fiyatı olmayan işletmeler yalnızca filtre aktifken dışarıda kalır
      const hasPriceFilter = priceMin != null || priceMax != null;
      const tenantPrice = getTenantPrice(t);
      const matchPrice =
        !hasPriceFilter ||
        (tenantPrice != null &&
          matchesPriceRange(tenantPrice, priceMin, priceMax));

      // Müsaitlik filtresi: "bugün müsait" seçildiyse yalnızca bugün gerçekten
      // boş slotu olan işletmeler kalsın. (Bu filtre daha önce hiç uygulanmıyordu:
      // sayaç 1 gösteriyor, liste değişmiyordu.)
      const matchAvailability =
        filterAvailability !== "today" || availability[t.id]?.hasFreeSlot === true;

      return (
        matchSector &&
        matchProvince &&
        matchDistrict &&
        matchSearch &&
        matchPrice &&
        matchAvailability
      );
    });
  }, [
    tenants,
    filterSector,
    filterProvince,
    filterDistrict,
    search,
    minPrice,
    maxPrice,
    filterAvailability,
    availability,
  ]);

  const availableTodayCount = filtered.filter(
    (tenant) => availability[tenant.id]?.hasFreeSlot,
  ).length;

  return (
    <PullToRefresh
      onRefresh={fetchData}
      refreshingLabel={lang === "tr" ? "Yenileniyor..." : "Refreshing..."}
    >
    <Presence
      swapKey={loading ? "loading" : "content"}
      enterClassName="animate-fade-rise-in"
      exitClassName="animate-fade-rise-out"
    >
    {loading ? (
      <DiscoverSkeleton />
    ) : (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans select-none">
      {/* Arama çubuğu kaydırma sırasında üstte sabitlenir (native his).
          Kök içeriğin doğrudan çocuğu olmalı: sticky, ancak ebeveynin sınırları
          içinde çalışır; başlık grubunun içinde olsaydı liste kayarken kaybolurdu. */}
      <div className="sticky -top-3 z-20 -mx-3 -mt-2 flex items-center gap-2.5 bg-white px-3 py-2 sm:-top-6 sm:-mx-6 sm:gap-3 sm:px-6 md:-top-8 md:-mx-8 md:px-8 dark:bg-slate-950">
          {/* Arama Kutusu */}
          <div className="relative flex-1 group min-w-0">
            <div className="pointer-events-none absolute left-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-all lg:bg-indigo-50 lg:text-indigo-600 lg:dark:bg-indigo-950/70 lg:dark:text-indigo-400 lg:group-focus-within:bg-indigo-600 lg:group-focus-within:text-white lg:group-focus-within:shadow-md lg:group-focus-within:shadow-indigo-500/20">
              <Search size={17} strokeWidth={2.6} />
            </div>
            <input
              type="text"
              placeholder={
                lang === "tr"
                  ? "İşletme, konum veya kategori ara..."
                  : "Search business, location or category..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white py-3.5 pl-13 pr-10 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:border-slate-800 dark:bg-slate-900 dark:text-white lg:bg-white lg:shadow-sm lg:focus:ring-indigo-500 lg:dark:bg-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={
                  lang === "tr" ? "Aramayı temizle" : "Clear search"
                }
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Airbnb Tarzı Tek Oval "Filtrele" Butonu */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-200 active:scale-[0.98] lg:rounded-2xl lg:px-5 lg:py-3.5 lg:active:scale-95 ${
              activeFilterCount > 0
                ? "border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] shadow-[0_1px_2px_rgb(15,23,42,0.04)] lg:border-[var(--brand)] lg:bg-[var(--brand)] lg:text-white lg:shadow-md"
                : "border-transparent bg-slate-100 text-slate-700 shadow-[0_1px_2px_rgb(15,23,42,0.04)] dark:bg-slate-800 dark:text-slate-200 lg:border-slate-200/80 lg:bg-white lg:text-slate-700 lg:shadow-sm lg:hover:border-slate-300 lg:dark:border-slate-800 lg:dark:bg-slate-900 lg:dark:text-slate-200 lg:dark:hover:border-slate-700"
            }`}
          >
            <SlidersHorizontal size={17} strokeWidth={2.2} />
            {/* Etiket artık mobilde de görünür; eski `hidden sm:inline` kuralı
                kaldırıldı (masaüstünde zaten `sm` ile görünüyordu). */}
            <span>{lang === "tr" ? "Filtrele" : "Filters"}</span>
            {activeFilterCount > 0 && (
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
                  activeFilterCount > 0
                    ? "bg-[var(--brand)] text-white"
                    : ""
                }`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Hızlı Temizle Butonu (Filtre veya arama varsa) */}
          {(activeFilterCount > 0 || search) && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="shrink-0 cursor-pointer rounded-2xl border border-rose-200/80 bg-rose-50 p-3.5 text-rose-600 transition-all active:scale-90 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 lg:border-red-200/60 lg:bg-red-50/80 lg:text-red-600 lg:hover:bg-red-100 lg:dark:border-red-500/20 lg:dark:bg-red-500/10 lg:dark:text-red-400 lg:dark:hover:bg-red-500/20"
              title={
                lang === "tr" ? "Tüm Filtreleri Temizle" : "Clear All Filters"
              }
              aria-label={
                lang === "tr" ? "Tüm Filtreleri Temizle" : "Clear All Filters"
              }
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

      <div className="-mt-2 flex flex-col gap-4">
        {/* Kategori Çipleri */}
        <div className="w-full">
          <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain py-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterSector("")}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 sm:px-5 sm:py-2 sm:text-sm ${
                filterSector === ""
                  ? "bg-[var(--brand)] text-white shadow-[0_4px_14px_var(--brand-shadow)]"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {lang === "tr" ? "Tümü" : "All"}
            </button>

            {combinedSectors.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() =>
                  setFilterSector(filterSector === s.value ? "" : s.value)
                }
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 sm:px-5 sm:py-2 sm:text-sm ${
                  filterSector === s.value
                    ? "bg-[var(--brand)] text-white shadow-[0_4px_14px_var(--brand-shadow)]"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Aktif Filtre Rozetleri Çubuğu (Varsa) */}
        {(filterProvince || filterDistrict || minPrice || maxPrice) && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
            <span className="text-slate-500 font-medium dark:text-slate-400 lg:text-slate-400">
              {lang === "tr" ? "Filtreler:" : "Filters:"}
            </span>
            {filterProvince && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] px-3 py-1 font-bold text-[var(--brand-text)] lg:border-indigo-200 lg:bg-indigo-50 lg:text-indigo-600 lg:dark:border-indigo-500/20 lg:dark:bg-indigo-500/10 lg:dark:text-indigo-400">
                <MapPin size={12} />
                <span>
                  {filterProvince} {filterDistrict ? `• ${filterDistrict}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterProvince("");
                    setFilterDistrict("");
                  }}
                  className="hover:opacity-75"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 lg:border-amber-200 lg:bg-amber-50 lg:text-amber-600 lg:dark:border-amber-500/20 lg:dark:bg-amber-500/10 lg:dark:text-amber-400">
                <span>
                  ₺{minPrice || "0"} - ₺{maxPrice || "∞"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="hover:opacity-75"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          <span className="font-bold text-slate-900 dark:text-white">
            {filtered.length}{" "}
            {lang === "tr"
              ? "işletme"
              : filtered.length === 1
                ? "business"
                : "businesses"}
          </span>
          {availableTodayCount > 0 && (
            <>
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {availableTodayCount}{" "}
                {lang === "tr" ? "bugün müsait" : "available today"}
              </span>
            </>
          )}
        </p>
        <SegmentedControl
          className="w-[46%] shrink-0 sm:w-64"
          value={viewMode}
          onChange={setViewMode}
          options={[
            {
              value: "list",
              icon: List,
              label: lang === "tr" ? "Liste" : "List",
              ariaLabel: lang === "tr" ? "Liste Görünümü" : "List View",
            },
            {
              value: "map",
              icon: MapIcon,
              label: lang === "tr" ? "Harita" : "Map",
              ariaLabel: lang === "tr" ? "Harita Görünümü" : "Map View",
            },
          ]}
        />
      </div>

      {/* Ana İçerik: Harita veya Liste Görünümü */}
      {viewMode === "map" ? (
        /* HARİTA GÖRÜNÜMÜ (Apple Maps Deneyimi) */
        <div className="space-y-4 animate-in fade-in duration-300">
          <DiscoverMap
            tenants={filtered}
            selectedTenant={selectedMapTenant}
            onSelectTenant={setSelectedMapTenant}
            getTenantPrice={getTenantPrice}
            getTenantRating={getTenantRating}
            getSectorLabel={getSectorLabel}
            getCoverImage={getCoverImage}
            areaLabel={
              [filterDistrict, filterProvince].filter(Boolean).join(", ") ||
              (lang === "tr" ? "Türkiye genelinde" : "Across Türkiye")
            }
            lang={lang}
          />
        </div>
      ) : (
        /* LİSTE GÖRÜNÜMÜ (Airbnb Seviyesi Zengin Keşfet Kartları) */
        <div>
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)] lg:rounded-[32px] lg:border-slate-200/50 lg:bg-white lg:px-4 lg:py-28 lg:text-slate-400 lg:shadow-sm lg:dark:border-slate-800/50 lg:dark:bg-slate-900">
              <Building2
                size={56}
                className="mx-auto mb-4 text-slate-300 dark:text-slate-700"
              />
              <p className="text-[15px] font-bold text-slate-900 dark:text-white lg:text-lg lg:text-slate-700 lg:dark:text-slate-300">
                {lang === "tr"
                  ? "Eşleşen işletme bulunamadı"
                  : "No matching businesses found"}
              </p>
              <p className="mt-1 max-w-sm mx-auto text-sm text-slate-500 dark:text-slate-400">
                {lang === "tr"
                  ? "Farklı bir il, ilçe veya sektör filtresi deneyebilir ya da aramayı sıfırlayabilirsiniz."
                  : "Try changing your location, category or clear filters."}
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-[0_6px_16px_var(--brand-shadow)] transition-all active:scale-[0.98] lg:rounded-full lg:bg-slate-900 lg:px-6 lg:py-2.5 lg:font-bold lg:shadow-md lg:hover:bg-slate-800 lg:active:scale-95 lg:dark:bg-white lg:dark:text-slate-900 lg:dark:hover:bg-slate-100"
              >
                {lang === "tr" ? "Filtreleri Temizle" : "Clear Filters"}
              </button>
            </div>
          ) : (
            <>
              <div className="stagger-list grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-7">
                {filtered.map((tenant) => {
                  const sectorLabel = getSectorLabel(tenant.sector);
                  const price = getTenantPrice(tenant);
                  const rating = getTenantRating(tenant);
                  const coverImage = getCoverImage(tenant);
                  const isFavorited = favorites.includes(tenant.id);
                  const tenantAvailability = availability[tenant.id];

                  return (
                    <Fragment key={tenant.id}>
                      {/* ---------------------------------------------- */}
                      {/* MOBİL: geniş görselli işletme kartı */}
                      {/* ---------------------------------------------- */}
                      <div className="pressable relative flex flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)] lg:hidden">
                        {/* Kartın tamamı gerçek bağlantı (stretched link) */}
                        <Link
                          href={`/b/${tenant.slug}`}
                          aria-label={tenant.name}
                          className="absolute inset-0 z-[1] rounded-[26px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                        />

                        {/* Geniş kapak görseli, müsaitlik, fiyat ve favori */}
                        <div className="relative h-[210px] w-full bg-slate-100 dark:bg-slate-800 sm:h-[260px]">
                          <SafeImage
                            src={coverImage}
                            alt={tenant.name}
                            fallbackSrc={getSectorImage(tenant)}
                            fallbackIcon={
                              <Building2
                                size={40}
                                className="text-[var(--brand)]"
                              />
                            }
                            className="h-full w-full object-cover"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                          {tenantAvailability?.hasFreeSlot && (
                            <div className="pointer-events-none absolute left-4 top-4 z-[2] inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-bold text-slate-900 shadow-md backdrop-blur">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {tenantAvailability.nextSlot
                                ? lang === "tr"
                                  ? `Bugün ${tenantAvailability.nextSlot} müsait`
                                  : `Available today at ${tenantAvailability.nextSlot}`
                                : lang === "tr"
                                  ? "Bugün müsait"
                                  : "Available today"}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(tenant.id);
                            }}
                            aria-label={
                              isFavorited
                                ? lang === "tr"
                                  ? "Favorilerden Çıkar"
                                  : "Remove from favorites"
                                : lang === "tr"
                                  ? "Favorilere Ekle"
                                  : "Add to favorites"
                            }
                            title={isFavorited ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                            className="absolute right-4 top-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-md backdrop-blur transition-transform active:scale-90 dark:bg-slate-900/90 dark:text-slate-300"
                          >
                            <Heart
                              key={isFavorited ? "on" : "off"}
                              size={18}
                              className={`transition-colors ${
                                isFavorited
                                  ? "animate-heart-pop fill-rose-500 text-rose-500 stroke-rose-500"
                                  : "stroke-[2.2]"
                              }`}
                            />
                          </button>
                          {price != null && (
                            <span className="pointer-events-none absolute bottom-4 left-4 z-[2] rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-extrabold text-white shadow-lg">
                              ₺{price}
                              <span className="ml-1 font-medium text-white/80">
                                {lang === "tr" ? "'den başlayan" : "starting"}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
                                {tenant.name}
                              </h3>
                              <p className="mt-1 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                                {sectorLabel} ·{" "}
                                {tenant.district ||
                                  tenant.province ||
                                  (lang === "tr"
                                    ? "Konum belirtilmedi"
                                    : "No location")}
                              </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm font-extrabold text-slate-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-white">
                              <Star size={14} className="fill-amber-400 text-amber-400" />
                              {rating.score}
                              {rating.hasReviews && (
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                  ({rating.reviews})
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <div className="min-w-0">
                              {rating.hasReviews ? (
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  {rating.reviews}{" "}
                                  {lang === "tr" ? "değerlendirme" : "reviews"}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">
                                  {lang === "tr"
                                    ? "Henüz değerlendirilmedi"
                                    : "No reviews yet"}
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/b/${tenant.slug}/randevu`}
                              aria-label={`${tenant.name} — ${
                                lang === "tr" ? "Randevu Al" : "Book"
                              }`}
                              className="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_4px_12px_var(--brand-shadow)] transition-all active:scale-[0.98]"
                            >
                              {lang === "tr" ? "Randevu Al" : "Book now"}
                              <ChevronRight size={15} />
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* ------------------------------------------- */}
                      {/* MASAÜSTÜ: mevcut Airbnb tarzı zengin kart */}
                      {/* ------------------------------------------- */}
                      <div className="group relative hidden lg:flex flex-col bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/70 dark:border-slate-800/70 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/90 dark:hover:border-slate-700/90 transition-all duration-300 cursor-pointer overflow-hidden">
                      {/*
                        Kartın tamamı GERÇEK bir bağlantıdır (stretched link):
                        klavye ile odaklanabilir, uzun basıp/ctrl ile yeni
                        sekmede açılabilir, ekran okuyucu bağlantı olarak
                        duyurur. Önceden `<div onClick>` idi ve bu yolların
                        hiçbiri çalışmıyordu. Favori butonu z-10 ile üstte
                        kaldığı için kendi tıklamasını almaya devam eder.
                      */}
                      <Link
                        href={`/b/${tenant.slug}`}
                        aria-label={tenant.name}
                        className="absolute inset-0 z-[1] rounded-[28px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                      />
                      {/* Kapak Görseli (Airbnb Tarzı aspect-video) */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {/* Sol Üst: Müsaitlik Rozeti.
                            Yalnızca GERÇEKTEN bugün boş slotu varsa görünür;
                            kapalı/dolu işletmede rozet gösterilmez (önceden
                            her kartta sabit basılıyordu ve yanlış bilgi veriyordu). */}
                        {tenantAvailability?.hasFreeSlot && (
                          <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 dark:bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>
                              {tenantAvailability.nextSlot
                                ? lang === "tr"
                                  ? `Bugün ${tenantAvailability.nextSlot} müsait`
                                  : `Today ${tenantAvailability.nextSlot}`
                                : lang === "tr"
                                  ? "Bugün Müsait"
                                  : "Available Today"}
                            </span>
                          </div>
                        )}

                        {/* Sağ Üst: Yarı Saydam Kalp (Favori) Butonu */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(tenant.id);
                          }}
                          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/35 dark:bg-black/55 backdrop-blur-md text-white border border-white/20 hover:scale-110 active:scale-90 transition-all cursor-pointer shadow-xs"
                          title={
                            isFavorited
                              ? "Favorilerden Çıkar"
                              : "Favorilere Ekle"
                          }
                        >
                          <Heart
                            key={isFavorited ? "on" : "off"}
                            size={18}
                            className={`transition-colors ${
                              isFavorited
                                ? "animate-heart-pop fill-rose-500 text-rose-500 stroke-rose-500"
                                : "text-white stroke-[2.2]"
                            }`}
                          />
                        </button>

                        {/* Sağ Alt: Sektör Etiketi (sol alt profil fotoğrafına ayrıldı) */}
                        <div className="pointer-events-none absolute bottom-3 right-3 z-10 px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-100 text-[11px] font-bold shadow-xs">
                          {sectorLabel}
                        </div>

                        {/* Görsel */}
                        <SafeImage
                          src={coverImage}
                          alt={tenant.name}
                          fallbackSrc={getSectorImage(tenant)}
                          fallbackIcon={
                            <Building2
                              size={40}
                              className="text-indigo-400/70"
                            />
                          }
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      </div>

                      {/* Kart Bilgileri (Airbnb Hiyerarşisi) */}
                      <div className="p-5 pt-0 flex flex-col flex-1">
                        {/* Profil Fotoğrafı: kapak görselinden taşan avatar */}
                        <div className="pointer-events-none relative z-20 -mt-8 mb-3 flex items-end">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md dark:border-slate-900 dark:bg-slate-800">
                            <SafeImage
                              src={tenant.profile_image_url}
                              alt={tenant.name}
                              className="h-full w-full object-cover"
                              fallbackIcon={
                                <Building2
                                  size={26}
                                  className="text-indigo-600 dark:text-indigo-400"
                                />
                              }
                            />
                          </div>
                        </div>

                        {/* İşletme Adı */}
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg sm:text-xl leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {tenant.name}
                        </h3>

                        {/* Puan Satırı */}
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold mt-1.5">
                          <Star
                            size={14}
                            className="fill-amber-400 text-amber-400"
                          />
                          <span>{rating.score}</span>
                          {rating.hasReviews ? (
                            <span className="text-slate-400 font-normal">
                              ({rating.reviews}{" "}
                              {lang === "tr" ? "değerlendirme" : "reviews"})
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">
                              (
                              {lang === "tr"
                                ? "Henüz değerlendirilmedi"
                                : "No reviews"}
                              )
                            </span>
                          )}
                        </div>

                        {/* Tam Konum */}
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-2">
                          <MapPin
                            size={15}
                            className="text-slate-400 shrink-0"
                          />
                          <span className="line-clamp-1">
                            {formatFullAddress(tenant) ||
                              [tenant.district, tenant.province]
                                .filter(Boolean)
                                .join(", ") ||
                              (lang === "tr"
                                ? "Konum belirtilmedi"
                                : "No location")}
                          </span>
                        </div>

                        {/* Fiyat Bilgisi & Randevu Al Butonu */}
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <div>
                            {price != null ? (
                              <>
                                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  {lang === "tr" ? "Başlangıç" : "Starts at"}
                                </p>
                                <p className="text-base font-black text-slate-900 dark:text-white">
                                  ₺{price}
                                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                                    {lang === "tr" ? "'den başlayan" : ""}
                                  </span>
                                </p>
                              </>
                            ) : (
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                                {lang === "tr"
                                  ? "Fiyat bilgisi yok"
                                  : "Price not available"}
                              </p>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                            <span>
                              {lang === "tr" ? "Randevu Al" : "Book Now"}
                            </span>
                            <ChevronRight size={16} />
                          </span>
                        </div>
                      </div>
                    </div>
                    </Fragment>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* AIRBNB TARZI ŞEFFAF BOTTOM SHEET (FİLTRE ÇEKMECESİ) */}
      {isFilterSheetOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200 sm:p-4">
            {/* Backdrop Click Dismiss */}
            <div
              className="fixed inset-0"
              onClick={() => setIsFilterSheetOpen(false)}
            />

            {/* Bottom Sheet Modal */}
            <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 z-10">
              {/* Drag Handle */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 shrink-0 sm:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 dark:border-slate-800/70 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {lang === "tr" ? "Filtreler" : "Filters"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === "tr"
                      ? "Aramayı daraltmak için tercihlerinizi seçin"
                      : "Refine your discovery results"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Filter Options */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-0">
                {/* 1. Konum (İl ve İlçe) */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                    <MapPin
                      size={16}
                      className="text-indigo-600 dark:text-indigo-400"
                    />
                    <span>
                      {lang === "tr"
                        ? "Konum (İl & İlçe)"
                        : "Location (Province & District)"}
                    </span>
                  </h4>

                  {/* İl Ara Arama Kutusu */}
                  <div className="relative mb-3">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder={
                        lang === "tr"
                          ? "İl ara (örn: İstanbul, Ankara)..."
                          : "Search province..."
                      }
                      value={provinceSearch}
                      onChange={(e) => setProvinceSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {provinceSearch && (
                      <button
                        type="button"
                        onClick={() => setProvinceSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* İl Çipleri (Kaydırılabilir / Wrap) */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterProvince("");
                        setFilterDistrict("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        filterProvince === ""
                          ? "bg-[var(--brand)] text-white shadow-xs"
                          : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {lang === "tr" ? "Tüm İller" : "All Provinces"}
                    </button>
                    {filteredProvinces.map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => {
                          if (filterProvince === prov) {
                            setFilterProvince("");
                            setFilterDistrict("");
                          } else {
                            setFilterProvince(prov);
                            setFilterDistrict("");
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          filterProvince === prov
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>

                  {/* İlçe Seçimi (Eğer bir il seçiliyse) */}
                  {filterProvince && uniqueDistricts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        {filterProvince}{" "}
                        {lang === "tr" ? "İlçeleri:" : "Districts:"}
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => setFilterDistrict("")}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            filterDistrict === ""
                              ? "bg-[var(--brand)] text-white shadow-xs"
                              : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {lang === "tr" ? "Tüm İlçeler" : "All Districts"}
                        </button>
                        {uniqueDistricts.map((dist) => (
                          <button
                            key={dist}
                            type="button"
                            onClick={() =>
                              setFilterDistrict(
                                filterDistrict === dist ? "" : dist,
                              )
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              filterDistrict === dist
                                ? "bg-[var(--brand)] text-white shadow-xs"
                                : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {dist}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Kategori Seçimi */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5">
                    {lang === "tr" ? "Kategori / Sektör" : "Category / Sector"}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterSector("")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        filterSector === ""
                          ? "bg-[var(--brand)] text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {lang === "tr" ? "Tümü" : "All"}
                    </button>
                    {combinedSectors.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setFilterSector(
                            filterSector === s.value ? "" : s.value,
                          )
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          filterSector === s.value
                            ? "bg-[var(--brand)] text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Fiyat Aralığı (Tümü veya elle min/maks) */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5">
                    {lang === "tr" ? "Fiyat Aralığı" : "Price Range"}
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                      }}
                      className={`flex-1 sm:flex-none sm:w-32 p-3 rounded-2xl border text-center transition-all ${
                        !minPrice && !maxPrice
                          ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-500/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-sm font-extrabold">
                        {lang === "tr" ? "Tümü" : "All"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {lang === "tr" ? "Tüm Fiyatlar" : "Any price"}
                      </div>
                    </button>

                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="flex items-center h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <span className="text-sm font-bold text-slate-400 select-none shrink-0 mr-1.5 leading-none">
                          ₺
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder={lang === "tr" ? "Min" : "Min"}
                          className="w-full py-3 bg-transparent text-sm font-bold text-slate-800 dark:text-white placeholder:font-medium placeholder:text-slate-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="flex items-center h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <span className="text-sm font-bold text-slate-400 select-none shrink-0 mr-1.5 leading-none">
                          ₺
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder={lang === "tr" ? "Maks" : "Max"}
                          className="w-full py-3 bg-transparent text-sm font-bold text-slate-800 dark:text-white placeholder:font-medium placeholder:text-slate-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {lang === "tr"
                      ? "Boş bırakılan sınır sınırsız kabul edilir."
                      : "An empty limit means no limit."}
                  </p>
                </div>

                {/* 4. Müsaitlik Durumu */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5">
                    {lang === "tr" ? "Müsaitlik Durumu" : "Availability"}
                  </h4>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFilterAvailability("all")}
                      className={`flex-1 py-3 px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all text-center ${
                        filterAvailability === "all"
                          ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {lang === "tr" ? "Tüm Müsaitlikler" : "All Availability"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterAvailability("today")}
                      className={`flex-1 py-3 px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        filterAvailability === "today"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        {lang === "tr" ? "Bugün Müsait" : "Available Today"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sabit Alt Çubuk (Sticky Footer) */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors underline underline-offset-4 cursor-pointer"
                >
                  {lang === "tr" ? "Filtreleri Temizle" : "Clear All"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="flex-1 max-w-xs py-3 px-5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs sm:text-sm font-extrabold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {lang === "tr"
                      ? `Sonuçları Göster (${filtered.length})`
                      : `Show Results (${filtered.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
    )}
    </Presence>
    </PullToRefresh>
  );
}
