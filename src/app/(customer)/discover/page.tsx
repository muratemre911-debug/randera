'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { Building2, MapPin, Search, Loader2, ChevronRight, X, ChevronDown } from 'lucide-react';
import citiesData from "@/lib/cities.json";

export const dynamic = 'force-dynamic';

interface Tenant {
  id: string;
  name: string;
  sector: string | null;
  province: string | null;
  district: string | null;
  slug: string;
  profile_image_url: string | null;
}

interface Sector {
  name: string;
  value: string;
}

export default function DiscoverPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterSector, setFilterSector] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [search, setSearch] = useState('');

  const [isProvinceOpen, setIsProvinceOpen] = useState(false);
  const [isDistrictOpen, setIsDistrictOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    try {
      // İşletmeleri çek - önce is_active, yoksa tümünü çek
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, sector, province, district, slug, profile_image_url')
        .eq('is_active', true);

      if (tenantError) {
        const { data: allTenants } = await supabase
          .from('tenants')
          .select('id, name, sector, province, district, slug, profile_image_url');
        if (allTenants) setTenants(allTenants as Tenant[]);
      } else if (tenantData) {
        setTenants(tenantData as Tenant[]);
      }

      // Sektörleri API üzerinden çek (RLS'yi atlar)
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

  // Dinamik filtre seçenekleri
  const uniqueProvinces = Object.keys(citiesData);
  const uniqueDistricts = filterProvince 
    ? (citiesData as Record<string, string[]>)[filterProvince] || [] 
    : [];

  // Sektörü value/name bazında normalize eden yardımcı
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

  // Filtrelenmiş işletmeler
  const filtered = tenants.filter((t) => {
    const matchSector = !filterSector || getSectorKey(t.sector) === getSectorKey(filterSector);
    const matchProvince = !filterProvince || t.province === filterProvince;
    const matchDistrict = !filterDistrict || t.district === filterDistrict;
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.sector ?? '').toLowerCase().includes(search.toLowerCase());
    return matchSector && matchProvince && matchDistrict && matchSearch;
  });

  // Sektör adını çöz: value/name eşleşirse dinamik adı, 'other' ise 'Diğer', yoksa baş harf büyüt
  const getSectorLabel = (value: string | null) => {
    if (!value) return null;

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

  // Profil fotoğrafı yoksa isimden renk üret
  const placeholderColors = [
    'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500', 
    'bg-purple-100 dark:bg-purple-900/40 text-purple-500', 
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-500', 
    'bg-rose-100 dark:bg-rose-900/40 text-rose-500', 
    'bg-amber-100 dark:bg-amber-900/40 text-amber-500', 
    'bg-sky-100 dark:bg-sky-900/40 text-sky-500',
  ];
  const getPlaceholderColor = (name: string) => {
    const idx = name.charCodeAt(0) % placeholderColors.length;
    return placeholderColors[idx];
  };

  // Kombine edilmiş sektör listesi
  const combinedSectors = sectors.length > 0
    ? sectors
    : Array.from(new Set(tenants.map((t) => t.sector).filter(Boolean))).map((sec) => ({
        value: sec as string,
        name: getSectorLabel(sec as string) || sec as string,
      }));

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-12 font-sans">
      {/* Hero / Arama Alanı */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
              {lang === 'tr' ? 'Keşfet' : 'Discover'}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              {lang === 'tr'
                ? 'Size en uygun işletmeyi bulun ve hemen randevu alın.'
                : 'Find the best business for you and book instantly.'}
            </p>
          </div>
          
          <div className="relative w-full md:w-[26rem] shrink-0">
            <Search
              size={20}
              strokeWidth={2.5}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 dark:text-purple-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder={lang === 'tr' ? 'İşletme veya sektör ara...' : 'Search businesses or sectors...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

      {/* Filtreler */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Sektör Filtresi (Pill Chips) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide flex-1 mask-linear-fade">
            <button
              onClick={() => setFilterSector('')}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                filterSector === ''
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                  : 'bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 backdrop-blur-3xl border border-slate-200/50 dark:border-slate-700/50'
              }`}
            >
              {lang === 'tr' ? 'Tümü' : 'All'}
            </button>
            
            {combinedSectors.map((s) => (
              <button
                key={s.value}
                onClick={() => setFilterSector(s.value)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  filterSector === s.value
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                    : 'bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 backdrop-blur-3xl border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Konum Filtreleri */}
          <div className="flex items-center gap-3 shrink-0">
            {/* İl Filtresi Custom Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProvinceOpen(!isProvinceOpen)}
                className="flex items-center justify-between w-44 pl-4 pr-3 py-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/60 backdrop-blur-3xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white shadow-sm transition-colors"
              >
                <span className="truncate mr-2">
                  {filterProvince || (lang === 'tr' ? 'Tüm İller' : 'All Provinces')}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-slate-400 shrink-0 transition-transform duration-300 ${isProvinceOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isProvinceOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProvinceOpen(false)}
                  ></div>
                  <ul className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto overflow-x-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl shadow-2xl rounded-2xl border border-white/40 dark:border-slate-700/50 p-1.5 custom-scrollbar">
                    <li
                      className="px-3 py-2 text-sm rounded-xl text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => {
                        setFilterProvince('');
                        setFilterDistrict('');
                        setIsProvinceOpen(false);
                      }}
                    >
                      {lang === 'tr' ? 'Tüm İller' : 'All Provinces'}
                    </li>
                    {uniqueProvinces.map((p) => (
                      <li
                        key={p}
                        className={`px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors ${
                          filterProvince === p
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          setFilterProvince(p);
                          setFilterDistrict('');
                          setIsProvinceOpen(false);
                        }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* İlçe Filtresi Custom Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDistrictOpen(!isDistrictOpen)}
                disabled={!filterProvince && uniqueDistricts.length === 0}
                className="flex items-center justify-between w-44 pl-4 pr-3 py-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/60 backdrop-blur-3xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <span className="truncate mr-2">
                  {filterDistrict || (lang === 'tr' ? 'Tüm İlçeler' : 'All Districts')}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-slate-400 shrink-0 transition-transform duration-300 ${isDistrictOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isDistrictOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDistrictOpen(false)}
                  ></div>
                  <ul className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto overflow-x-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl shadow-2xl rounded-2xl border border-white/40 dark:border-slate-700/50 p-1.5 custom-scrollbar">
                    <li
                      className="px-3 py-2 text-sm rounded-xl text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => {
                        setFilterDistrict('');
                        setIsDistrictOpen(false);
                      }}
                    >
                      {lang === 'tr' ? 'Tüm İlçeler' : 'All Districts'}
                    </li>
                    {uniqueDistricts.map((d) => (
                      <li
                        key={d}
                        className={`px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors ${
                          filterDistrict === d
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          setFilterDistrict(d);
                          setIsDistrictOpen(false);
                        }}
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Filtreleri Temizle */}
            {(filterSector || filterProvince || filterDistrict || search) && (
              <button
                onClick={() => {
                  setFilterSector('');
                  setFilterProvince('');
                  setFilterDistrict('');
                  setSearch('');
                }}
                className="p-2.5 rounded-2xl bg-red-50/80 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center border border-red-200/50 dark:border-red-900/50 backdrop-blur-3xl shadow-sm"
                title={lang === 'tr' ? 'Filtreleri Temizle' : 'Clear Filters'}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

      {/* İşletme Kartları */}
      <div>
        {loading ? (
          <div className="flex justify-center py-32">
            <Loader2 size={40} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <Building2 size={56} className="mx-auto mb-5 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
              {lang === 'tr' ? 'İşletme bulunamadı.' : 'No businesses found.'}
            </p>
            <button 
              onClick={() => {
                setFilterSector('');
                setFilterProvince('');
                setFilterDistrict('');
                setSearch('');
              }}
              className="mt-4 px-6 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-full text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              {lang === 'tr' ? 'Aramayı Temizle' : 'Clear Search'}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-5 px-1">
              {filtered.length} {lang === 'tr' ? 'işletme listeleniyor' : 'businesses listed'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filtered.map((tenant) => {
                const sectorLabel = getSectorLabel(tenant.sector);
                return (
                  <div
                    key={tenant.id}
                    onClick={() => router.push(`/b/${tenant.slug}`)}
                    className="group bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[28px] border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/80 dark:hover:border-slate-700/80 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                  >
                    {/* Kart Görseli (16:9) */}
                    <div
                      className={`relative aspect-video w-full overflow-hidden ${
                        tenant.profile_image_url ? '' : getPlaceholderColor(tenant.name)
                      }`}
                    >
                      {/* Floating Sektör Rozeti */}
                      {sectorLabel && (
                        <div className="absolute top-4 left-4 z-10 px-3.5 py-1.5 bg-black/30 dark:bg-black/50 backdrop-blur-md text-white/95 rounded-full text-xs font-semibold shadow-sm border border-white/20">
                          {sectorLabel}
                        </div>
                      )}

                      {tenant.profile_image_url ? (
                        <img
                          src={tenant.profile_image_url}
                          alt={tenant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2
                            size={48}
                            className="group-hover:scale-110 transition-transform duration-500 ease-out opacity-80"
                          />
                        </div>
                      )}
                    </div>

                    {/* Kart Detayları */}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white text-xl leading-tight mb-2.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {tenant.name}
                      </h3>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">
                        <MapPin size={16} className="text-slate-400 shrink-0" />
                        <span className="line-clamp-1">
                          {[tenant.province, tenant.district].filter(Boolean).join(', ') || (lang === 'tr' ? 'Konum belirtilmedi' : 'No location')}
                        </span>
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <span>{lang === 'tr' ? 'Randevu Al' : 'Book Now'}</span>
                        <ChevronRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}