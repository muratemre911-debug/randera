"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import SafeImage from "@/components/SafeImage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  Heart,
  MapPin,
  Star,
  ChevronRight,
  Compass,
  Loader2,
  Calendar,
  Building2,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  sector: string | null;
  province: string | null;
  district: string | null;
  slug: string;
  profile_image_url: string | null;
  cover_image_url: string | null;
}

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
  default:
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80",
};

export default function FavoritesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();

  // Favoriler tarayıcıda saklanır; ilk render'da okunur
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("randera_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantPrices, setTenantPrices] = useState<Record<string, number>>({});
  const [ratingSummary, setRatingSummary] = useState<
    Record<string, { average_rating: number | null; total_reviews: number }>
  >({});
  /** İşletme id → bugünkü müsaitlik durumu (gerçek veri). */
  const [availability, setAvailability] = useState<
    Record<string, { hasFreeSlot: boolean; nextSlot: string | null }>
  >({});
  const [loading, setLoading] = useState(true);

  // Fetch favorited businesses and their real ratings
  useEffect(() => {
    const fetchFavoriteTenants = async () => {
      setLoading(true);
      try {
        // Fetch all active tenants
        const { data: tenantData } = await supabase
          .from("tenants")
          .select(
            "id, name, sector, province, district, slug, profile_image_url, cover_image_url",
          )
          .eq("is_active", true);

        if (tenantData) {
          setTenants(tenantData as Tenant[]);
        }

        // Fetch prices
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

        // Fetch real ratings
        const revRes = await fetch("/api/reviews?summary=true");
        const revData = await revRes.json();
        if (revData && !revData.error) {
          setRatingSummary(revData);
        }

        // Gerçek müsaitlik (bugün boş slot var mı) — tek toplu istek.
        if (tenantData && tenantData.length > 0) {
          try {
            const ids = tenantData.map((t) => t.id).join(",");
            const availRes = await fetch(`/api/availability?ids=${ids}`);
            if (availRes.ok) {
              const availData = await availRes.json();
              if (availData && !availData.error) {
                setAvailability(availData);
              }
            }
          } catch (err) {
            console.error("Availability fetch error:", err);
          }
        }
      } catch (err) {
        console.error("Failed to load favorites data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteTenants();
  }, [supabase]);

  const removeFavorite = (tenantId: string) => {
    const updated = favorites.filter((id) => id !== tenantId);
    setFavorites(updated);
    try {
      localStorage.setItem("randera_favorites", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const favoriteTenants = useMemo(() => {
    return tenants.filter((t) => favorites.includes(t.id));
  }, [tenants, favorites]);

  const getSectorImage = (tenant: Tenant) => {
    const sectorKey = tenant.sector?.toLowerCase() || "";
    for (const [key, img] of Object.entries(SECTOR_IMAGES)) {
      if (sectorKey.includes(key)) return img;
    }
    return SECTOR_IMAGES.default;
  };

  const getCoverImage = (tenant: Tenant) => {
    if (tenant.cover_image_url) return tenant.cover_image_url;
    if (tenant.profile_image_url) return tenant.profile_image_url;
    return getSectorImage(tenant);
  };

  // Fiyat: yalnızca gerçek hizmet fiyatı varsa gösterilir (uydurma fiyat yok)
  const getTenantPrice = (tenant: Tenant): number | null => {
    const price = tenantPrices[tenant.id];
    return price != null ? price : null;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans select-none animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-normal">
            {lang === "tr" ? "Favori İşletmelerim" : "My Favorites"}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
            {lang === "tr"
              ? "Beğendiğiniz işletmeleri buradan takip edin ve anında randevu alın."
              : "Keep track of your favorite places and book with a single tap."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/discover")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Compass size={16} />
          <span>{lang === "tr" ? "Daha Fazla Keşfet" : "Explore More"}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 size={40} className="animate-spin text-slate-400" />
        </div>
      ) : favoriteTenants.length === 0 ? (
        /* Empty State */
        <div className="text-center py-24 sm:py-32 px-4 rounded-[32px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <Heart size={32} className="stroke-[2.2]" />
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            {lang === "tr" ? "Henüz favori işletmeniz yok" : "No favorites yet"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            {lang === "tr"
              ? "Keşfet ekranında gördüğünüz işletmelerin sağ üstündeki kalp butonuna dokunarak favorilerinize ekleyebilirsiniz."
              : "Tap the heart icon on any business card in Discover to save your favorite businesses here."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/discover")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Compass size={16} />
            <span>
              {lang === "tr" ? "İşletmeleri Keşfet" : "Discover Places"}
            </span>
          </button>
        </div>
      ) : (
        /* Favorites Grid */
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
              {favoriteTenants.length}{" "}
              {lang === "tr" ? "favori işletme" : "saved places"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {favoriteTenants.map((tenant) => {
              const coverImage = getCoverImage(tenant);
              const price = getTenantPrice(tenant);
              const ratingInfo = ratingSummary[tenant.id];

              return (
                <div
                  key={tenant.id}
                  className="group relative bg-white/75 dark:bg-slate-900/65 backdrop-blur-3xl rounded-[28px] border border-slate-200/70 dark:border-slate-800/70 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/90 dark:hover:border-slate-700/90 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                >
                  {/* Kartın tamamı gerçek bir bağlantı (stretched link):
                      klavye erişimi + yeni sekmede açma + ekran okuyucu uyumu. */}
                  <Link
                    href={`/b/${tenant.slug}`}
                    aria-label={tenant.name}
                    className="absolute inset-0 z-[1] rounded-[28px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  />
                  {/* Aspect Video Cover Image */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {/* Müsaitlik Rozeti — yalnızca gerçekten boş slot varsa.
                        Önceden her kartta sabit basılıyordu. */}
                    {availability[tenant.id]?.hasFreeSlot && (
                      <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 dark:bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>
                          {availability[tenant.id].nextSlot
                            ? lang === "tr"
                              ? `Bugün ${availability[tenant.id].nextSlot} müsait`
                              : `Today ${availability[tenant.id].nextSlot}`
                            : lang === "tr"
                              ? "Bugün Müsait"
                              : "Available Today"}
                        </span>
                      </div>
                    )}

                    {/* Favoriden Kaldır Butonu (Kırmızı Kalp) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(tenant.id);
                      }}
                      className="absolute top-3 right-3 z-10 p-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/20 hover:scale-110 active:scale-90 transition-all cursor-pointer shadow-md"
                      title="Favorilerden Kaldır"
                    >
                      <Heart
                        size={18}
                        className="fill-rose-500 text-rose-500 stroke-rose-500"
                      />
                    </button>

                    {/* Sektör Çipi (sol alt profil fotoğrafına ayrıldı) */}
                    {tenant.sector && (
                      <div className="pointer-events-none absolute bottom-3 right-3 z-10 px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-100 text-[11px] font-bold shadow-xs capitalize">
                        {tenant.sector}
                      </div>
                    )}

                    <SafeImage
                      src={coverImage}
                      alt={tenant.name}
                      fallbackSrc={getSectorImage(tenant)}
                      fallbackIcon={
                        <Building2 size={40} className="text-indigo-400/70" />
                      }
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </div>

                  {/* Body */}
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

                    <h3 className="font-bold text-slate-900 dark:text-white text-lg sm:text-xl leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {tenant.name}
                    </h3>

                    {/* Gerçek Puan */}
                    <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold mt-1.5">
                      <Star
                        size={14}
                        className="fill-amber-400 text-amber-400"
                      />
                      {ratingInfo?.average_rating ? (
                        <span>
                          {ratingInfo.average_rating}{" "}
                          <span className="text-slate-400 font-normal">
                            ({ratingInfo.total_reviews}{" "}
                            {lang === "tr" ? "değerlendirme" : "reviews"})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                          {lang === "tr" ? "Yeni İşletme" : "New"}
                        </span>
                      )}
                    </div>

                    {/* Konum */}
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-2">
                      <MapPin size={15} className="text-slate-400 shrink-0" />
                      <span className="line-clamp-1">
                        {[tenant.district, tenant.province]
                          .filter(Boolean)
                          .join(", ") ||
                          (lang === "tr"
                            ? "Konum belirtilmedi"
                            : "No location")}
                      </span>
                    </div>

                    {/* Fiyat & Hızlı Randevu Al */}
                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {lang === "tr" ? "Başlangıç" : "Starts at"}
                        </p>
                        <p className="text-base font-black text-slate-900 dark:text-white">
                          {price != null ? (
                            <>₺{price}</>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                              {lang === "tr"
                                ? "Fiyat bilgisi yok"
                                : "Price not available"}
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/b/${tenant.slug}/randevu`);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Calendar size={13} />
                        <span>{lang === "tr" ? "Randevu Al" : "Book"}</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
