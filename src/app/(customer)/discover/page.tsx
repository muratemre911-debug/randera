"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import {
  Building2,
  MapPin,
  Search,
  Loader2,
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
import { formatFullAddress } from "@/lib/address";
import { matchesPriceRange, parsePrice } from "@/lib/price";
import { isDiscoverable } from "@/lib/membership";
import DiscoverMap, {
  TenantWithDetails,
} from "@/components/discover/DiscoverMap";

export const dynamic = "force-dynamic";

interface Sector {
  name: string;
  value: string;
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
  const router = useRouter();
  const { lang } = useLanguage();

  const [tenants, setTenants] = useState<TenantWithDetails[]>([]);
  const [tenantPrices, setTenantPrices] = useState<Record<string, number>>({});
  const [ratingSummary, setRatingSummary] = useState<
    Record<string, { average_rating: number | null; total_reviews: number }>
  >({});
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Favorites state (tarayıcıda saklanır)
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("randera_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (tenantId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(tenantId)
        ? prev.filter((id) => id !== tenantId)
        : [...prev, tenantId];
      try {
        localStorage.setItem("randera_favorites", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
          setTenants(rows.filter((t) => isDiscoverable(t)));
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
  const getCoverImage = (tenant: TenantWithDetails) => {
    if (tenant.cover_image_url) return tenant.cover_image_url;
    if (tenant.profile_image_url) return tenant.profile_image_url;
    const sectorKey = tenant.sector?.toLowerCase() || "";
    for (const [key, img] of Object.entries(SECTOR_IMAGES)) {
      if (sectorKey.includes(key)) return img;
    }
    return SECTOR_IMAGES.default;
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

      return (
        matchSector &&
        matchProvince &&
        matchDistrict &&
        matchSearch &&
        matchPrice
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
  ]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans select-none">
      {/* Üst Başlık & Arama / Filtre Bölümü */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-normal">
              {lang === "tr" ? "Keşfet" : "Discover"}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
              {lang === "tr"
                ? "Size en uygun işletmeyi bulun ve anında randevu alın."
                : "Find the best business for you and book instantly."}
            </p>
          </div>

          {/* Segmented Control (Apple Maps Style) */}
          <div className="inline-flex p-1 bg-slate-200/70 dark:bg-slate-800/80 backdrop-blur-2xl rounded-2xl border border-slate-300/40 dark:border-slate-700/50 shadow-inner self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <List size={16} strokeWidth={2.4} />
              <span>{lang === "tr" ? "Liste Görünümü" : "List View"}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                viewMode === "map"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <MapIcon size={16} strokeWidth={2.4} />
              <span>{lang === "tr" ? "Harita Görünümü" : "Map View"}</span>
            </button>
          </div>
        </div>

        {/* Minimalist Apple Maps Tarzı Arama Çubuğu + Tek Oval Filtre Butonu */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Arama Kutusu */}
          <div className="relative flex-1 group">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 group-focus-within:bg-indigo-600 group-focus-within:text-white group-focus-within:shadow-md group-focus-within:shadow-indigo-500/20 transition-all pointer-events-none">
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
              className="w-full pl-13 pr-10 py-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
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
            className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 cursor-pointer shadow-sm border shrink-0 ${
              activeFilterCount > 0
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md"
                : "bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <SlidersHorizontal size={17} strokeWidth={2.2} />
            <span className="hidden xs:inline">
              {lang === "tr" ? "Filtrele" : "Filters"}
            </span>
            {activeFilterCount > 0 && (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                  activeFilterCount > 0
                    ? "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white"
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
              className="p-3.5 rounded-2xl bg-red-50/80 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-500/20 transition-all active:scale-90 cursor-pointer shrink-0"
              title={
                lang === "tr" ? "Tüm Filtreleri Temizle" : "Clear All Filters"
              }
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

        {/* Kategori Çipleri */}
        <div className="w-full">
          <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain py-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterSector("")}
              className={`whitespace-nowrap px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shrink-0 ${
                filterSector === ""
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-indigo-500/20"
                  : "bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60"
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
                className={`whitespace-nowrap px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shrink-0 ${
                  filterSector === s.value
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-indigo-500/20"
                    : "bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60"
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
            <span className="text-slate-400 font-medium">
              {lang === "tr" ? "Filtreler:" : "Filters:"}
            </span>
            {filterProvince && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-500/20">
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
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-500/20">
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

      {/* Ana İçerik: Harita veya Liste Görünümü */}
      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 size={40} className="animate-spin text-slate-400" />
        </div>
      ) : viewMode === "map" ? (
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
            lang={lang}
          />
        </div>
      ) : (
        /* LİSTE GÖRÜNÜMÜ (Airbnb Seviyesi Zengin Keşfet Kartları) */
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-28 px-4 text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
              <Building2
                size={56}
                className="mx-auto mb-4 text-slate-300 dark:text-slate-700"
              />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {lang === "tr"
                  ? "Eşleşen işletme bulunamadı"
                  : "No matching businesses found"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {lang === "tr"
                  ? "Farklı bir il, ilçe veya sektör filtresi deneyebilir ya da aramayı sıfırlayabilirsiniz."
                  : "Try changing your location, category or clear filters."}
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-5 px-6 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-full text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                {lang === "tr" ? "Filtreleri Temizle" : "Clear Filters"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 px-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {filtered.length}{" "}
                  {lang === "tr" ? "işletme listeleniyor" : "businesses found"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
                {filtered.map((tenant) => {
                  const sectorLabel = getSectorLabel(tenant.sector);
                  const price = getTenantPrice(tenant);
                  const rating = getTenantRating(tenant);
                  const coverImage = getCoverImage(tenant);
                  const isFavorited = favorites.includes(tenant.id);

                  return (
                    <div
                      key={tenant.id}
                      onClick={() => router.push(`/b/${tenant.slug}`)}
                      className="group bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[28px] border border-slate-200/70 dark:border-slate-800/70 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/90 dark:hover:border-slate-700/90 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                    >
                      {/* Kapak Görseli (Airbnb Tarzı aspect-video) */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {/* Sol Üst: 'Bugün Müsait' Rozeti */}
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 dark:bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>
                            {lang === "tr" ? "Bugün Müsait" : "Available Today"}
                          </span>
                        </div>

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
                            size={18}
                            className={`transition-colors ${
                              isFavorited
                                ? "fill-rose-500 text-rose-500 stroke-rose-500"
                                : "text-white stroke-[2.2]"
                            }`}
                          />
                        </button>

                        {/* Sağ Alt: Sektör Etiketi (sol alt profil fotoğrafına ayrıldı) */}
                        <div className="absolute bottom-3 right-3 z-10 px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-100 text-[11px] font-bold shadow-xs">
                          {sectorLabel}
                        </div>

                        {/* Görsel */}
                        <img
                          src={coverImage}
                          alt={tenant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      </div>

                      {/* Kart Bilgileri (Airbnb Hiyerarşisi) */}
                      <div className="p-5 pt-0 flex flex-col flex-1">
                        {/* Profil Fotoğrafı: kapak görselinden taşan avatar */}
                        <div className="relative z-20 -mt-8 mb-3 flex items-end">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md dark:border-slate-900 dark:bg-slate-800">
                            {tenant.profile_image_url ? (
                              <img
                                src={tenant.profile_image_url}
                                alt={tenant.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Building2
                                size={26}
                                className="text-indigo-600 dark:text-indigo-400"
                              />
                            )}
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
                        <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
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
                          ? "bg-indigo-600 text-white shadow-xs"
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
                            ? "bg-indigo-600 text-white shadow-xs"
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
                              ? "bg-indigo-600 text-white shadow-xs"
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
                                ? "bg-indigo-600 text-white shadow-xs"
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
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
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
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
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
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-sm"
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
  );
}
