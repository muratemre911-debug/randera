"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import {
  Calendar as CalendarIcon,
  MapPin,
  Building2,
  Star,
  Heart,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Tag,
  Wrench,
  Clock,
  Edit3,
  Navigation,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import type { Tenant, Post, Service } from "@/types";
import { BusinessPageSkeleton, Spinner } from "@/components/Skeleton";
import MapPoint from "@/components/MapPoint";
import { formatFullAddress } from "@/lib/address";
import { getPalette, paletteCss } from "@/lib/palettes";
import { PostGrid } from "@/components/PostGrid";
import { PostModal } from "@/components/PostModal";
import ReviewModal from "@/components/ReviewModal";
import ManageReviewsModal, {
  UserReviewItem,
} from "@/components/ManageReviewsModal";

interface PostWithTenant extends Post {
  tenant?: Pick<Tenant, "id" | "name" | "profile_image_url">;
}

interface ReviewItem {
  appointment_id: string;
  customer_id: string | null;
  customer_name: string;
  avatar_url?: string;
  rating: number;
  comment: string;
  created_at: string;
  service_name?: string;
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  total_reviews: number;
  average_rating: number | null;
  distribution: Record<number, number>;
  eligible_appointment_id: string | null;
  eligible_appointments?: Array<{
    id: string;
    service_name?: string;
    start_time: string;
  }>;
  can_review?: boolean;
  user_reviews?: UserReviewItem[];
  user_has_reviewed: boolean;
}

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();
  const locale = lang === "tr" ? tr : enUS;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [posts, setPosts] = useState<PostWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPost, setSelectedPost] = useState<PostWithTenant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Tab State: Hizmetler • Değerlendirmeler • Paylaşımlar • Konum
  const [activeTab, setActiveTab] = useState<
    "services" | "reviews" | "posts" | "location"
  >("posts");

  // Haritada işaretlenmiş konum var mı?
  const hasLocation = tenant?.latitude != null && tenant?.longitude != null;

  // Reviews state
  const [reviewsData, setReviewsData] = useState<ReviewsResponse>({
    reviews: [],
    total_reviews: 0,
    average_rating: null,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    eligible_appointment_id: null,
    can_review: false,
    user_reviews: [],
    user_has_reviewed: false,
  });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  // Favorites state
  const [isFavorited, setIsFavorited] = useState(false);

  // Sticky Mobile Bar State & Ref
  const [showStickyBar, setShowStickyBar] = useState(false);
  const mainButtonRef = useRef<HTMLDivElement>(null);

  const minPrice =
    services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  // Ana randevu butonu yukarı kayıp ekrandan çıktığında üst yapışkan barı tetikle
  useEffect(() => {
    if (!mainButtonRef.current) return;
    const target = mainButtonRef.current;
    const scrollContainer = document.querySelector("main");

    const checkVisibility = () => {
      if (!target) return;
      const targetRect = target.getBoundingClientRect();
      const containerRect = scrollContainer
        ? scrollContainer.getBoundingClientRect()
        : { top: 0 };
      // Ana buton kaydırma alanının üstünden yukarı çıktığında barı göster
      setShowStickyBar(targetRect.bottom < containerRect.top);
    };

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", checkVisibility, {
        passive: true,
      });
      checkVisibility();
      return () =>
        scrollContainer.removeEventListener("scroll", checkVisibility);
    }
  }, [loading]);

  const fetchTenantData = async () => {
    setLoading(true);
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .single();

    if (tenantError || !tenantData) {
      setError(lang === "tr" ? "İşletme bulunamadı" : "Business not found");
      setLoading(false);
      return;
    }
    setTenant(tenantData);

    // Fetch services
    const { data: servicesData } = await supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenantData.id)
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (servicesData) {
      setServices(servicesData);
    }

    // Check favorite status
    try {
      const saved = localStorage.getItem("randera_favorites");
      if (saved) {
        const favs: string[] = JSON.parse(saved);
        setIsFavorited(favs.includes(tenantData.id));
      }
    } catch {
      // ignore
    }

    // Fetch posts
    const postsRes = await fetch(`/api/posts?tenant_id=${tenantData.id}`);
    const postsData = await postsRes.json();
    if (Array.isArray(postsData)) {
      const postsWithTenant = postsData.map((post: Post) => ({
        ...post,
        tenant: {
          id: tenantData.id,
          name: tenantData.name,
          profile_image_url: tenantData.profile_image_url,
        },
      }));
      setPosts(postsWithTenant);
    }

    // Fetch reviews
    try {
      const revRes = await fetch(`/api/reviews?tenant_id=${tenantData.id}`);
      const revData = await revRes.json();
      if (revData && !revData.error) {
        setReviewsData(revData);
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    }

    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- veri çekme efekti; yükleme durumu burada yönetilir
    fetchTenantData();
  }, [slug]);

  const toggleFavorite = () => {
    if (!tenant) return;
    try {
      const saved = localStorage.getItem("randera_favorites");
      let favs: string[] = saved ? JSON.parse(saved) : [];
      if (favs.includes(tenant.id)) {
        favs = favs.filter((id) => id !== tenant.id);
        setIsFavorited(false);
      } else {
        favs.push(tenant.id);
        setIsFavorited(true);
      }
      localStorage.setItem("randera_favorites", JSON.stringify(favs));
    } catch {
      // ignore
    }
  };

  const handleLikeToggle = async (postId: string) => {
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to toggle like");
    }
    const data = await res.json();

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? { ...p, user_has_liked: data.liked, like_count: data.likeCount }
          : p,
      ),
    );

    setSelectedPost((prev) =>
      prev && prev.id === postId
        ? { ...prev, user_has_liked: data.liked, like_count: data.likeCount }
        : prev,
    );

    return data;
  };

  const handleAddComment = async (postId: string, text: string) => {
    const res = await fetch(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to add comment");
    }
    const data = await res.json();

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comment_count: data.commentCount ?? (p.comment_count || 0) + 1,
            }
          : p,
      ),
    );

    setSelectedPost((prev) =>
      prev && prev.id === postId
        ? {
            ...prev,
            comment_count: data.commentCount ?? (prev.comment_count || 0) + 1,
          }
        : prev,
    );

    return data;
  };

  const handlePostClick = (post: PostWithTenant) => {
    setSelectedPost(post);
    setModalOpen(true);
  };

  const handleReviewSuccess = () => {
    if (!tenant) return;
    fetch(`/api/reviews?tenant_id=${tenant.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setReviewsData(data);
      });
  };

  if (loading) {
    return <BusinessPageSkeleton />;
  }

  if (error || !tenant) {
    return (
      <div className="w-full max-w-4xl mx-auto h-64 flex items-center justify-center">
        <div className="text-center">
          <Spinner
            size="h-12 w-12"
            className="mx-auto mb-4"
            color="text-red-500"
          />
          <p className="text-red-500 dark:text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-scope w-full max-w-4xl mx-auto space-y-8 pb-16 font-sans select-none relative">
      {/* İşletmenin seçtiği palet (açık/koyu varyant müşterinin temasına göre) */}
      <style>{paletteCss(getPalette(tenant.theme_palette))}</style>

      {/* Banner & Profile Container */}
      <div className="relative">
        {/* Cover Image Banner */}
        <div
          className="w-full h-48 sm:h-56 md:h-64 bg-cover bg-center relative rounded-[32px] overflow-hidden shadow-sm"
          style={{
            backgroundImage: tenant.cover_image_url
              ? `url(${tenant.cover_image_url})`
              : `url(${tenant.profile_image_url || "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80"})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

          {/* Favori Kalp Butonu */}
          <button
            type="button"
            onClick={toggleFavorite}
            className="absolute top-4 right-4 p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/20 transition-all active:scale-90 cursor-pointer shadow-lg z-20"
            title={isFavorited ? "Favorilerden Çıkar" : "Favorilere Ekle"}
          >
            <Heart
              size={20}
              className={`transition-colors ${
                isFavorited
                  ? "fill-rose-500 text-rose-500 stroke-rose-500"
                  : "text-white stroke-[2.2]"
              }`}
            />
          </button>
        </div>

        {/* Profile Section */}
        <div className="relative z-10">
          <div className="-mt-12 md:-mt-16 mb-4 ml-6 md:ml-8 flex items-end justify-between">
            {/* Profile Image / Avatar */}
            <div className="h-24 w-24 md:h-28 md:w-28 shrink-0 rounded-full border-[5px] border-white dark:border-slate-900 shadow-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center">
              {tenant.profile_image_url ? (
                <img
                  src={tenant.profile_image_url}
                  alt={tenant.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2
                  size={40}
                  className="text-[var(--brand-text)] text-[var(--brand-text)]"
                />
              )}
            </div>
          </div>

          <div className="pb-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {tenant.name}
            </h1>

            {/* Gerçek Puan & Sektör & Konum Barı */}
            <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 mt-3 text-xs sm:text-sm font-medium">
              {/* Gerçek Puan Rozeti */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("reviews");
                  const el = document.getElementById("business-tabs");
                  const mainEl = document.querySelector("main");
                  if (el && mainEl) {
                    const targetOffset =
                      el.getBoundingClientRect().top -
                      mainEl.getBoundingClientRect().top +
                      mainEl.scrollTop -
                      20;
                    mainEl.scrollTo({
                      top: Math.max(0, targetOffset),
                      behavior: "smooth",
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold border border-amber-200/80 dark:border-amber-500/25 hover:scale-105 transition-transform cursor-pointer text-left"
              >
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {reviewsData.average_rating ? (
                  <span>
                    {reviewsData.average_rating}{" "}
                    <span className="font-normal opacity-80">
                      ({reviewsData.total_reviews}{" "}
                      {lang === "tr" ? "değerlendirme" : "reviews"})
                    </span>
                  </span>
                ) : (
                  <span>
                    {lang === "tr"
                      ? "Yeni (Henüz puanlanmadı)"
                      : "New (No reviews yet)"}
                  </span>
                )}
              </button>

              {tenant.sector && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-text)] text-[var(--brand-text)] border border-[var(--brand-border)] border-[var(--brand-border)] shadow-xs capitalize">
                  <Tag
                    size={12}
                    className="text-[var(--brand-text)] text-[var(--brand-text)] shrink-0"
                  />
                  <span>{tenant.sector}</span>
                </span>
              )}

              {(tenant.address || tenant.province || tenant.district) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-slate-400 shrink-0" />
                  {formatFullAddress(tenant) ||
                    [tenant.address, tenant.district, tenant.province]
                      .filter(Boolean)
                      .join(", ")}
                </span>
              )}
            </div>

            {/* Randevu Al & Yorum Butonları */}
            <div
              ref={mainButtonRef}
              className="mt-5 flex items-center gap-2.5 sm:gap-3 flex-wrap"
            >
              <button
                type="button"
                onClick={() => router.push(`/b/${slug}/randevu`)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-strong)] px-5 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-lg shadow-[color:var(--brand-shadow)] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <CalendarIcon size={17} />
                <span>{lang === "tr" ? "Randevu Al" : "Book Appointment"}</span>
              </button>

              {/* Yorum Hakkı Kuralı: Sadece bu işletmede tamamlanmış ve henüz yorumlanmamış randevusu varsa 'Yeni Yorum Yap' */}
              {reviewsData.can_review && (
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-4 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Star size={15} className="fill-amber-400 text-amber-400" />
                  <span>
                    {lang === "tr" ? "Yeni Yorum Yap" : "Write a Review"}
                  </span>
                </button>
              )}

              {/* Yorumları Yönet / Düzenle: Müşterinin bu işletmeye yaptığı geçmiş yorumları düzenleme butonu */}
              {reviewsData.user_has_reviewed && (
                <button
                  type="button"
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] text-[var(--brand-text)] text-[var(--brand-text)] border border-[var(--brand-border)] border-[var(--brand-border)] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Edit3 size={15} />
                  <span>
                    {lang === "tr" ? "Yorumlarımı Düzenle" : "Edit My Reviews"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* APPLE / AIRBNB TARZI YATAY SEKME (SEGMENTED CONTROL) ÇUBUĞU */}
      <div
        id="business-tabs"
        className="sticky top-0 z-30 -mx-3 sm:-mx-6 md:-mx-8 px-3 sm:px-6 md:px-8 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 transition-all scroll-mt-4 flex items-center justify-between gap-3 select-none"
      >
        <div className="flex items-center p-1 sm:p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 w-auto backdrop-blur-md gap-1 overflow-x-auto scrollbar-none snap-x shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={`flex-1 sm:flex-none shrink-0 snap-start flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-[11px] min-[400px]:text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "services"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>{lang === "tr" ? "Hizmetler" : "Services"}</span>
            {services.length > 0 && (
              <span className="hidden min-[400px]:inline text-[11px] opacity-70 font-normal">
                ({services.length})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 sm:flex-none shrink-0 snap-start flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-[11px] min-[400px]:text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "reviews"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>{lang === "tr" ? "Değerlendirmeler" : "Reviews"}</span>
            <span className="hidden min-[400px]:inline text-[11px] opacity-70 font-normal">
              ({reviewsData.total_reviews})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("posts")}
            className={`flex-1 sm:flex-none shrink-0 snap-start flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-[11px] min-[400px]:text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "posts"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>{lang === "tr" ? "Paylaşımlar" : "Posts"}</span>
            {posts.length > 0 && (
              <span className="hidden min-[400px]:inline text-[11px] opacity-70 font-normal">
                ({posts.length})
              </span>
            )}
          </button>

          {hasLocation && (
            <button
              type="button"
              onClick={() => setActiveTab("location")}
              className={`flex-1 sm:flex-none shrink-0 snap-start flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-[11px] min-[400px]:text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "location"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>{lang === "tr" ? "Konum" : "Location"}</span>
            </button>
          )}
        </div>

        {/* Sağ: Değerlendirmeler, Paylaşımlar ve Konum'da ana buton kaybolunca beliren Randevu Al butonu */}
        {showStickyBar && activeTab !== "services" && (
          <div className="flex items-center gap-3 shrink-0 ml-auto animate-in fade-in slide-in-from-right-3 duration-200">
            {minPrice !== null && (
              <div className="hidden md:flex flex-col items-end text-right leading-tight">
                <span className="text-[10px] text-slate-400 font-medium">
                  {lang === "tr" ? "Başlangıç Fiyatı" : "Starting from"}
                </span>
                <span className="text-xs font-black text-[var(--brand-text)]">
                  ₺{minPrice}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push(`/b/${slug}/randevu`)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-strong)] px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-[color:var(--brand-shadow)] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <CalendarIcon size={14} strokeWidth={2.4} />
              <span>{lang === "tr" ? "Randevu Al" : "Book"}</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. SEKME: HİZMETLER MENÜSÜ */}
      {activeTab === "services" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {lang === "tr" ? "Hizmet Menüsü" : "Services Menu"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "tr"
                  ? "İşletmenin sunduğu profesyonel hizmetler ve süre bilgileri."
                  : "Professional services and durations offered by this business."}
              </p>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <Wrench size={32} className="text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {lang === "tr"
                  ? "Henüz listelenmiş hizmet bulunmuyor."
                  : "No services listed yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {services.map((s) => {
                const duration = s.duration || s.duration_minutes || 30;
                return (
                  <div
                    key={s.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-[var(--brand-border)] hover:border-[var(--brand-border)] transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-[var(--brand-text)] group-hover:text-[var(--brand-text)] transition-colors">
                          {s.name}
                        </h3>
                        <span className="shrink-0 text-base sm:text-lg font-black text-[var(--brand-text)] text-[var(--brand-text)]">
                          ₺{s.price}
                        </span>
                      </div>

                      {s.description && (
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {s.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                        <Clock size={14} className="text-slate-400" />
                        {duration} {lang === "tr" ? "dakika" : "min"}
                      </span>

                      <button
                        type="button"
                        onClick={() => router.push(`/b/${slug}/randevu`)}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] text-[var(--brand-text)] text-[var(--brand-text)] font-bold transition-all active:scale-95 cursor-pointer"
                      >
                        <span>{lang === "tr" ? "Randevu Al" : "Book"}</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. SEKME: AIRBNB TARZI DEĞERLENDİRMELER & YORUMLAR BÖLÜMÜ */}
      {activeTab === "reviews" && (
        <div id="reviews" className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{lang === "tr" ? "Değerlendirmeler" : "Reviews"}</span>
                {reviewsData.average_rating && (
                  <span className="text-base font-bold text-slate-500 dark:text-slate-400">
                    • ★ {reviewsData.average_rating} (
                    {reviewsData.total_reviews})
                  </span>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "tr"
                  ? "Yalnızca bu işletmeden randevusu tamamlanan gerçek müşterilerin yorumlarıdır."
                  : "Verified reviews from customers who completed an appointment."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {reviewsData.can_review && (
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 transition-colors shrink-0"
                >
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span>{lang === "tr" ? "Yeni Yorum Yap" : "Add Review"}</span>
                </button>
              )}

              {reviewsData.user_has_reviewed && (
                <button
                  type="button"
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-text)] text-[var(--brand-text)] text-xs font-bold hover:bg-[var(--brand-soft-hover)] transition-colors shrink-0"
                >
                  <Edit3 size={14} />
                  <span>
                    {lang === "tr" ? "Yorumlarımı Düzenle" : "Edit Reviews"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {reviewsData.reviews.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
                <Star size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {lang === "tr"
                  ? "Henüz değerlendirme yapılmamış"
                  : "No reviews yet"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {lang === "tr"
                  ? "Bu işletmeden randevu alıp tamamlayan ilk müşterilerden biri olarak deneyiminizi paylaşabilirsiniz."
                  : "Be one of the first customers to book and share your experience here."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Airbnb Tarzı Özet Kartı ve Dağılım Çubukları */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Sol: Büyük Puan Rozeti */}
                <div className="md:col-span-4 text-center md:text-left flex flex-col items-center md:items-start justify-center border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 pb-5 md:pb-0 md:pr-6">
                  <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                    {reviewsData.average_rating}
                  </div>
                  <div className="flex items-center gap-1 my-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={18}
                        className={`${
                          reviewsData.average_rating &&
                          s <= Math.round(reviewsData.average_rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 dark:text-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {reviewsData.total_reviews}{" "}
                    {lang === "tr"
                      ? "doğrulanmış değerlendirme"
                      : "verified reviews"}
                  </p>
                </div>

                {/* Sağ: 5-1 Yıldız Dağılım Çubukları */}
                <div className="md:col-span-8 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((starCount) => {
                    const count = reviewsData.distribution[starCount] || 0;
                    const percent =
                      reviewsData.total_reviews > 0
                        ? (count / reviewsData.total_reviews) * 100
                        : 0;

                    return (
                      <div
                        key={starCount}
                        className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        <span className="w-12 text-right shrink-0">
                          {starCount} yıldız
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-slate-400 text-[11px] shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Müşteri Yorum Kartları Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {reviewsData.reviews.map((rev) => (
                  <div
                    key={rev.appointment_id}
                    className="p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Yazar Bilgisi */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[var(--brand)] to-purple-500 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                            {rev.avatar_url ? (
                              <img
                                src={rev.avatar_url}
                                alt={rev.customer_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              rev.customer_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {rev.customer_name}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {format(parseISO(rev.created_at), "d MMMM yyyy", {
                                locale,
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Yıldızlar */}
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              className={
                                s <= rev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200 dark:text-slate-700"
                              }
                            />
                          ))}
                        </div>
                      </div>

                      {/* Alınan Hizmet & Doğrulanmış Rozet */}
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                        <ShieldCheck size={13} />
                        <span>
                          {lang === "tr"
                            ? "Doğrulanmış Randevu"
                            : "Verified Booking"}
                        </span>
                        {rev.service_name && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">
                              •
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                              {rev.service_name}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Yorum Metni */}
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SEKME: PAYLAŞIMLAR FEED */}
      {activeTab === "posts" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {lang === "tr" ? "İşletme Paylaşımları" : "Posts"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "tr"
                  ? "İşletmenin güncel duyuruları ve çalışmalarından kareler."
                  : "Latest updates and showcase photos from this business."}
              </p>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-400 dark:text-slate-500 rounded-3xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50">
              {lang === "tr" ? "Henüz gönderi paylaşılmamış." : "No posts yet."}
            </div>
          ) : (
            <PostGrid
              posts={posts}
              onPostClick={handlePostClick}
              isLoading={false}
            />
          )}
        </div>
      )}

      {/* 4. SEKME: KONUM */}
      {activeTab === "location" && hasLocation && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {lang === "tr" ? "Konum" : "Location"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {formatFullAddress(tenant) || tenant.address}
              </p>
            </div>
          </div>

          <div className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-xs">
            <MapPoint
              lat={tenant.latitude ?? null}
              lng={tenant.longitude ?? null}
              zoom={16}
              heightClass="h-80 sm:h-96"
              pinLabel={tenant.name}
              className="rounded-none border-0"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {[formatFullAddress(tenant), tenant.address]
                .filter(Boolean)
                .join(" • ")}
            </p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${tenant.latitude},${tenant.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-strong)] px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-[color:var(--brand-shadow)] active:scale-95 transition-all whitespace-nowrap"
            >
              <Navigation size={15} />
              <span>{lang === "tr" ? "Yol Tarifi Al" : "Get Directions"}</span>
            </a>
          </div>
        </div>
      )}

      {/* Post Modal */}
      <PostModal
        post={selectedPost}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onLikeToggle={handleLikeToggle}
        onAddComment={handleAddComment}
      />

      {/* New Review Modal */}
      {reviewsData.eligible_appointment_id && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          appointmentId={reviewsData.eligible_appointment_id}
          businessName={tenant.name}
          onSuccess={handleReviewSuccess}
        />
      )}

      {/* Manage / Edit Reviews Modal */}
      <ManageReviewsModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        businessName={tenant.name}
        reviews={reviewsData.user_reviews || []}
        onSuccess={handleReviewSuccess}
      />
    </div>
  );
}
