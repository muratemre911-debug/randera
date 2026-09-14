'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
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
} from 'lucide-react';
import citiesData from '@/lib/cities.json';
import DiscoverMap, { TenantWithDetails } from '@/components/discover/DiscoverMap';

export const dynamic = 'force-dynamic';

interface Sector {
  name: string;
  value: string;
}

// Curated high-res sector images for fallback
const SECTOR_IMAGES: Record<string, string> = {
  berber: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
  kuafor: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
  guzellik: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
  spa: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
  klinik: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80',
  dis: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80',
  dovme: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80',
};

export default function DiscoverPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();

  const [tenants, setTenants] = useState<TenantWithDetails[]>([]);
  const [tenantPrices, setTenantPrices] = useState<Record<string, number>>({});
  const [ratingSummary, setRatingSummary] = useState<Record<string, { average_rating: number | null; total_reviews: number }>>({});
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'list' or 'map' (Apple Maps style segmented control)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedMapTenant, setSelectedMapTenant] = useState<TenantWithDetails | null>(null);

  // Filters
  const [filterSector, setFilterSector] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterPrice, setFilterPrice] = useState<'all' | 'budget' | 'standard' | 'premium'>('all');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'today'>('all');
  const [search, setSearch] = useState('');

  // Bottom Sheet Filter Drawer state
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('randera_favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const toggleFavorite = (tenantId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(tenantId)
        ? prev.filter((id) => id !== tenantId)
        : [...prev, tenantId];
      try {
        localStorage.setItem('randera_favorites', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const fetchData = async () => {
    setLoading(true);

    try {
      // 1. İşletmeleri çek
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, sector, province, district, slug, profile_image_url, cover_image_url, address')
        .eq('is_active', true);

      if (tenantError) {
        const { data: allTenants } = await supabase
          .from('tenants')
          .select('id, name, sector, province, district, slug, profile_image_url, cover_image_url, address');
        if (allTenants) setTenants(allTenants as TenantWithDetails[]);
      } else if (tenantData) {
        setTenants(tenantData as TenantWithDetails[]);
      }

      // 2. Fiyatları çek
      const { data: servicesData } = await supabase
        .from('services')
        .select('tenant_id, price')
        .eq('is_active', true);

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
        const revRes = await fetch('/api/reviews?summary=true');
        const revData = await revRes.json();
        if (revData && !revData.error) {
          setRatingSummary(revData);
        }
      } catch (err) {
        console.error('Reviews summary fetch error:', err);
      }

      // 4. Sektörleri çek
      const sectorRes = await fetch('/api/admin/sectors');
      const sectorData = await sectorRes.json();
      if (Array.isArray(sectorData)) setSectors(sectorData as Sector[]);
    } catch (error) {
      console.error('Discover fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fiyat hesaplama
  const getTenantPrice = (tenant: TenantWithDetails) => {
    if (tenantPrices[tenant.id]) return tenantPrices[tenant.id];
    const hash = tenant.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 250 + (hash % 6) * 50; // 250, 300, 350, 400, 450, 500
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
      score: lang === 'tr' ? 'Yeni' : 'New',
      reviews: 0,
      hasReviews: false,
    };
  };

  // Kapak görseli çözümleme
  const getCoverImage = (tenant: TenantWithDetails) => {
    if (tenant.cover_image_url) return tenant.cover_image_url;
    if (tenant.profile_image_url) return tenant.profile_image_url;
    const sectorKey = tenant.sector?.toLowerCase() || '';
    for (const [key, img] of Object.entries(SECTOR_IMAGES)) {
      if (sectorKey.includes(key)) return img;
    }
    return SECTOR_IMAGES.default;
  };

  // Sektör adını çöz
  const getSectorLabel = (value: string | null) => {
    if (!value) return lang === 'tr' ? 'Hizmet' : 'Service';
    const normalized = value.trim().toLowerCase();
    const found = sectors.find(
      (s) =>
        s.value.trim().toLowerCase() === normalized ||
        s.name.trim().toLowerCase() === normalized
    );
    if (found) return found.name;
    if (normalized === 'other') return lang === 'tr' ? 'Diğer' : 'Other';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const getSectorKey = (val: string | null) => {
    if (!val) return null;
    const normalized = val.trim().toLowerCase();
    const found = sectors.find(
      (s) =>
        s.value.trim().toLowerCase() === normalized ||
        s.name.trim().toLowerCase() === normalized
    );
    return found ? found.value.trim().toLowerCase() : normalized;
  };

  // Kombine sektörler
  const combinedSectors = useMemo(() => {
    if (sectors.length > 0) return sectors;
    return Array.from(new Set(tenants.map((t) => t.sector).filter(Boolean))).map((sec) => ({
      value: sec as string,
      name: getSectorLabel(sec as string) || (sec as string),
    }));
  }, [sectors, tenants]);

  // Dinamik il/ilçe verileri
  const allProvinces = useMemo(() => Object.keys(citiesData), []);
  const filteredProvinces = useMemo(() => {
    if (!provinceSearch.trim()) return allProvinces;
    return allProvinces.filter((p) =>
      p.toLowerCase().includes(provinceSearch.toLowerCase().trim())
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
      filterPrice !== 'all',
      filterAvailability !== 'all',
    ].filter(Boolean).length;
  }, [filterProvince, filterDistrict, filterSector, filterPrice, filterAvailability]);

  // Filtreleri temizle
  const resetAllFilters = () => {
    setFilterSector('');
    setFilterProvince('');
    setFilterDistrict('');
    setFilterPrice('all');
    setFilterAvailability('all');
    setSearch('');
  };

  // Filtrelenmiş işletmeler
  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const matchSector = !filterSector || getSectorKey(t.sector) === getSectorKey(filterSector);
      const matchProvince = !filterProvince || t.province === filterProvince;
      const matchDistrict = !filterDistrict || t.district === filterDistrict;
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.sector ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.province ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.district ?? '').toLowerCase().includes(search.toLowerCase());

      // Fiyat filtresi
      const price = getTenantPrice(t);
      let matchPrice = true;
      if (filterPrice === 'budget') matchPrice = price <= 300;
      else if (filterPrice === 'standard') matchPrice = price > 300 && price <= 600;
      else if (filterPrice === 'premium') matchPrice = price > 600;

      return matchSector && matchProvince && matchDistrict && matchSearch && matchPrice;
    });
  }, [tenants, filterSector, filterProvince, filterDistrict, search, filterPrice]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans select-none">
      {/* Üst Başlık & Arama / Filtre Bölümü */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-normal">
              {lang === 'tr' ? 'Keşfet' : 'Discover'}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'tr'
                ? 'Size en uygun işletmeyi bulun ve anında randevu alın.'
                : 'Find the best business for you and book instantly.'}
            </p>
          </div>

          {/* Segmented Control (Apple Maps Style) */}
          <div className="inline-flex p-1 bg-slate-200/70 dark:bg-slate-800/80 backdrop-blur-2xl rounded-2xl border border-slate-300/40 dark:border-slate-700/50 shadow-inner self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List size={16} strokeWidth={2.4} />
              <span>{lang === 'tr' ? 'Liste Görünümü' : 'List View'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapIcon size={16} strokeWidth={2.4} />
              <span>{lang === 'tr' ? 'Harita Görünümü' : 'Map View'}</span>
            </button>
          </div>
        </div>

        {/* Minimalist Apple Maps Tarzı Arama Çubuğu + Tek Oval Filtre Butonu */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Arama Kutusu */}
          <div className="relative flex-1">
            <Search
              size={18}
              strokeWidth={2.5}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder={lang === 'tr' ? 'İşletme, konum veya kategori ara...' : 'Search business, location or category...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
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
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md'
                : 'bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <SlidersHorizontal size={17} strokeWidth={2.2} />
            <span className="hidden xs:inline">{lang === 'tr' ? 'Filtrele' : 'Filters'}</span>
            {activeFilterCount > 0 && (
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                activeFilterCount > 0
                  ? 'bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white'
                  : ''
              }`}>
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
              title={lang === 'tr' ? 'Tüm Filtreleri Temizle' : 'Clear All Filters'}
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>

        {/* Kategori Çipleri (Sağa doğru transparan gradyan fade overlay ile) */}
        <div className="relative w-full">
          {/* Sağ kenar fade efekti */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-l from-slate-50 dark:from-[#0B0D14] to-transparent z-10 rounded-r-2xl" />

          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none pr-14">
            <button
              type="button"
              onClick={() => setFilterSector('')}
              className={`whitespace-nowrap px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shrink-0 ${
                filterSector === ''
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-indigo-500/20'
                  : 'bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              {lang === 'tr' ? 'Tümü' : 'All'}
            </button>

            {combinedSectors.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setFilterSector(filterSector === s.value ? '' : s.value)}
                className={`whitespace-nowrap px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shrink-0 ${
                  filterSector === s.value
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Aktif Filtre Rozetleri Çubuğu (Varsa) */}
        {(filterProvince || filterDistrict || filterPrice !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
            <span className="text-slate-400 font-medium">{lang === 'tr' ? 'Filtreler:' : 'Filters:'}</span>
            {filterProvince && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-500/20">
                <MapPin size={12} />
                <span>{filterProvince} {filterDistrict ? `• ${filterDistrict}` : ''}</span>
                <button
                  type="button"
                  onClick={() => { setFilterProvince(''); setFilterDistrict(''); }}
                  className="hover:opacity-75"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {filterPrice !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-500/20">
                <span>{filterPrice === 'budget' ? '₺ (0-300 ₺)' : filterPrice === 'standard' ? '₺₺ (300-600 ₺)' : '₺₺₺ (600+ ₺)'}</span>
                <button type="button" onClick={() => setFilterPrice('all')} className="hover:opacity-75">
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
      ) : viewMode === 'map' ? (
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
              <Building2 size={56} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {lang === 'tr' ? 'Eşleşen işletme bulunamadı' : 'No matching businesses found'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {lang === 'tr'
                  ? 'Farklı bir il, ilçe veya sektör filtresi deneyebilir ya da aramayı sıfırlayabilirsiniz.'
                  : 'Try changing your location, category or clear filters.'}
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-5 px-6 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-full text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                {lang === 'tr' ? 'Filtreleri Temizle' : 'Clear Filters'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 px-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {filtered.length} {lang === 'tr' ? 'işletme listeleniyor' : 'businesses found'}
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
                          <span>{lang === 'tr' ? 'Bugün Müsait' : 'Available Today'}</span>
                        </div>

                        {/* Sağ Üst: Yarı Saydam Kalp (Favori) Butonu */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(tenant.id);
                          }}
                          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/35 dark:bg-black/55 backdrop-blur-md text-white border border-white/20 hover:scale-110 active:scale-90 transition-all cursor-pointer shadow-xs"
                          title={isFavorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                        >
                          <Heart
                            size={18}
                            className={`transition-colors ${
                              isFavorited
                                ? 'fill-rose-500 text-rose-500 stroke-rose-500'
                                : 'text-white stroke-[2.2]'
                            }`}
                          />
                        </button>

                        {/* Sol Alt: Sektör Etiketi */}
                        <div className="absolute bottom-3 left-3 z-10 px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-100 text-[11px] font-bold shadow-xs">
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
                      <div className="p-5 flex flex-col flex-1">
                        {/* İşletme Adı */}
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg sm:text-xl leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {tenant.name}
                        </h3>

                        {/* Puan Satırı */}
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold mt-1.5">
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                          <span>{rating.score}</span>
                          {rating.hasReviews ? (
                            <span className="text-slate-400 font-normal">
                              ({rating.reviews} {lang === 'tr' ? 'değerlendirme' : 'reviews'})
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">
                              ({lang === 'tr' ? 'Henüz değerlendirilmedi' : 'No reviews'})
                            </span>
                          )}
                        </div>

                        {/* Tam Konum */}
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-2">
                          <MapPin size={15} className="text-slate-400 shrink-0" />
                          <span className="line-clamp-1">
                            {[tenant.district, tenant.province].filter(Boolean).join(', ') ||
                              (lang === 'tr' ? 'Konum belirtilmedi' : 'No location')}
                          </span>
                        </div>

                        {/* Fiyat Bilgisi & Randevu Al Butonu */}
                        <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              {lang === 'tr' ? 'Başlangıç' : 'Starts at'}
                            </p>
                            <p className="text-base font-black text-slate-900 dark:text-white">
                              ₺{price}
                              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                                {lang === 'tr' ? '\'den başlayan' : ''}
                              </span>
                            </p>
                          </div>

                          <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                            <span>{lang === 'tr' ? 'Randevu Al' : 'Book Now'}</span>
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
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          {/* Backdrop Click Dismiss */}
          <div
            className="flex-1"
            onClick={() => setIsFilterSheetOpen(false)}
          />

          {/* Bottom Sheet Modal */}
          <div className="relative w-full max-w-2xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-t-[32px] border-t border-white/40 dark:border-slate-800 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-300">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'tr' ? 'Filtreler' : 'Filters'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'tr' ? 'Aramayı daraltmak için tercihlerinizi seçin' : 'Refine your discovery results'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Filter Options */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* 1. Konum (İl ve İlçe) */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                  <MapPin size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{lang === 'tr' ? 'Konum (İl & İlçe)' : 'Location (Province & District)'}</span>
                </h4>

                {/* İl Ara Arama Kutusu */}
                <div className="relative mb-3">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder={lang === 'tr' ? 'İl ara (örn: İstanbul, Ankara)...' : 'Search province...'}
                    value={provinceSearch}
                    onChange={(e) => setProvinceSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {provinceSearch && (
                    <button
                      type="button"
                      onClick={() => setProvinceSearch('')}
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
                      setFilterProvince('');
                      setFilterDistrict('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterProvince === ''
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {lang === 'tr' ? 'Tüm İller' : 'All Provinces'}
                  </button>
                  {filteredProvinces.map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => {
                        if (filterProvince === prov) {
                          setFilterProvince('');
                          setFilterDistrict('');
                        } else {
                          setFilterProvince(prov);
                          setFilterDistrict('');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        filterProvince === prov
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
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
                      {filterProvince} {lang === 'tr' ? 'İlçeleri:' : 'Districts:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => setFilterDistrict('')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          filterDistrict === ''
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {lang === 'tr' ? 'Tüm İlçeler' : 'All Districts'}
                      </button>
                      {uniqueDistricts.map((dist) => (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => setFilterDistrict(filterDistrict === dist ? '' : dist)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            filterDistrict === dist
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
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
                  {lang === 'tr' ? 'Kategori / Sektör' : 'Category / Sector'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterSector('')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      filterSector === ''
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {lang === 'tr' ? 'Tümü' : 'All'}
                  </button>
                  {combinedSectors.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setFilterSector(filterSector === s.value ? '' : s.value)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        filterSector === s.value
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Fiyat Aralığı (Airbnb Tarzı) */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5">
                  {lang === 'tr' ? 'Fiyat Aralığı' : 'Price Range'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: lang === 'tr' ? 'Tümü' : 'All', desc: 'Tüm Fiyatlar' },
                    { id: 'budget', label: '₺', desc: '0 - 300 ₺' },
                    { id: 'standard', label: '₺₺', desc: '300 - 600 ₺' },
                    { id: 'premium', label: '₺₺₺', desc: '600+ ₺' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFilterPrice(p.id as any)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        filterPrice === p.id
                          ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="text-sm font-extrabold">{p.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Müsaitlik Durumu */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5">
                  {lang === 'tr' ? 'Müsaitlik Durumu' : 'Availability'}
                </h4>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFilterAvailability('all')}
                    className={`flex-1 py-3 px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all text-center ${
                      filterAvailability === 'all'
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'tr' ? 'Tüm Müsaitlikler' : 'All Availability'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterAvailability('today')}
                    className={`flex-1 py-3 px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      filterAvailability === 'today'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{lang === 'tr' ? 'Bugün Müsait' : 'Available Today'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sabit Alt Çubuk (Sticky Footer) */}
            <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl flex items-center justify-between gap-4 shrink-0">
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors underline underline-offset-4 cursor-pointer"
              >
                {lang === 'tr' ? 'Filtreleri Temizle' : 'Clear All'}
              </button>

              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 max-w-xs py-3 px-5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs sm:text-sm font-extrabold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={16} strokeWidth={2.5} />
                <span>
                  {lang === 'tr'
                    ? `Sonuçları Göster (${filtered.length})`
                    : `Show Results (${filtered.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}