"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import type { Tenant, Post } from "@/types";
import { BusinessPageSkeleton, Spinner } from "@/components/Skeleton";
import { PostGrid } from "@/components/PostGrid";
import { PostModal } from "@/components/PostModal";
import ReviewModal from "@/components/ReviewModal";

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
  user_has_reviewed: boolean;
}

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();
  const locale = lang === "tr" ? tr : enUS;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [posts, setPosts] = useState<PostWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPost, setSelectedPost] = useState<PostWithTenant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Reviews state
  const [reviewsData, setReviewsData] = useState<ReviewsResponse>({
    reviews: [],
    total_reviews: 0,
    average_rating: null,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    eligible_appointment_id: null,
    user_has_reviewed: false,
  });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Favorites state
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    fetchTenantData();
  }, [slug]);

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
        tenant: { id: tenantData.id, name: tenantData.name, profile_image_url: tenantData.profile_image_url },
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
          : p
      )
    );

    setSelectedPost((prev) =>
      prev && prev.id === postId
        ? { ...prev, user_has_liked: data.liked, like_count: data.likeCount }
        : prev
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
          ? { ...p, comment_count: data.commentCount ?? ((p.comment_count || 0) + 1) }
          : p
      )
    );

    setSelectedPost((prev) =>
      prev && prev.id === postId
        ? { ...prev, comment_count: data.commentCount ?? ((prev.comment_count || 0) + 1) }
        : prev
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
          <Spinner size="h-12 w-12" className="mx-auto mb-4" color="text-red-500" />
          <p className="text-red-500 dark:text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-16 font-sans select-none">
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
        <div className="px-4 md:px-6 relative z-10">
          <div className="-mt-12 md:-mt-16 mb-4 ml-2 md:ml-4 flex items-end justify-between">
            {/* Profile Image / Avatar */}
            <div className="h-24 w-24 md:h-28 md:w-28 shrink-0 rounded-full border-[5px] border-white dark:border-slate-900 shadow-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center">
              {tenant.profile_image_url ? (
                <img src={tenant.profile_image_url} alt={tenant.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 size={40} className="text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
          </div>

          <div className="pb-2 ml-2 md:ml-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {tenant.name}
            </h1>

            {/* Gerçek Puan & Sektör & Konum Barı */}
            <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 mt-3 text-xs sm:text-sm font-medium">
              {/* Gerçek Puan Rozeti */}
              <a
                href="#reviews"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold border border-amber-200/80 dark:border-amber-500/25 hover:scale-105 transition-transform"
              >
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {reviewsData.average_rating ? (
                  <span>
                    {reviewsData.average_rating}{" "}
                    <span className="font-normal opacity-80">
                      ({reviewsData.total_reviews} {lang === "tr" ? "değerlendirme" : "reviews"})
                    </span>
                  </span>
                ) : (
                  <span>{lang === "tr" ? "Yeni (Henüz puanlanmadı)" : "New (No reviews yet)"}</span>
                )}
              </a>

              {tenant.sector && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50/90 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/25 shadow-xs capitalize">
                  <Tag size={12} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span>{tenant.sector}</span>
                </span>
              )}

              {(tenant.address || tenant.province || tenant.district) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-slate-400 shrink-0" />
                  {[tenant.address, tenant.district, tenant.province].filter(Boolean).join(", ")}
                </span>
              )}
            </div>

            {/* Randevu Al Butonu */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => router.push(`/b/${slug}/randevu`)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 px-8 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-lg shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer"
              >
                <CalendarIcon size={18} />
                <span>{lang === "tr" ? "Randevu Al" : "Book Appointment"}</span>
              </button>

              {reviewsData.eligible_appointment_id && (
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-6 py-3.5 text-xs sm:text-sm font-bold active:scale-95 transition-all cursor-pointer"
                >
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  <span>
                    {reviewsData.user_has_reviewed
                      ? (lang === "tr" ? "Yorumunu Düzenle" : "Edit Your Review")
                      : (lang === "tr" ? "İşletmeyi Değerlendir" : "Write a Review")}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AIRBNB TARZI DEĞERLENDİRMELER & YORUMLAR BÖLÜMÜ */}
      <div id="reviews" className="scroll-mt-6 pt-4">
        <div className="flex items-center justify-between mb-5 px-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{lang === "tr" ? "Değerlendirmeler" : "Reviews"}</span>
              {reviewsData.average_rating && (
                <span className="text-base font-bold text-slate-500 dark:text-slate-400">
                  • ★ {reviewsData.average_rating} ({reviewsData.total_reviews})
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === "tr"
                ? "Yalnızca bu işletmeden randevusu tamamlanan gerçek müşterilerin yorumlarıdır."
                : "Verified reviews from customers who completed an appointment."}
            </p>
          </div>

          {reviewsData.eligible_appointment_id && (
            <button
              type="button"
              onClick={() => setReviewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors shrink-0"
            >
              <MessageSquare size={14} />
              <span>{lang === "tr" ? "Yorum Yap" : "Add Review"}</span>
            </button>
          )}
        </div>

        {reviewsData.reviews.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
              <Star size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {lang === "tr" ? "Henüz değerlendirme yapılmamış" : "No reviews yet"}
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
                        reviewsData.average_rating && s <= Math.round(reviewsData.average_rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300 dark:text-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {reviewsData.total_reviews} {lang === "tr" ? "doğrulanmış değerlendirme" : "verified reviews"}
                </p>
              </div>

              {/* Sağ: 5-1 Yıldız Dağılım Çubukları */}
              <div className="md:col-span-8 space-y-1.5">
                {[5, 4, 3, 2, 1].map((starCount) => {
                  const count = reviewsData.distribution[starCount] || 0;
                  const percent = reviewsData.total_reviews > 0 ? (count / reviewsData.total_reviews) * 100 : 0;

                  return (
                    <div key={starCount} className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span className="w-12 text-right shrink-0">{starCount} yıldız</span>
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
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                          {rev.avatar_url ? (
                            <img src={rev.avatar_url} alt={rev.customer_name} className="w-full h-full object-cover" />
                          ) : (
                            rev.customer_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {rev.customer_name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {format(parseISO(rev.created_at), "d MMMM yyyy", { locale })}
                          </p>
                        </div>
                      </div>

                      {/* Yıldızlar */}
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={13}
                            className={s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Alınan Hizmet & Doğrulanmış Rozet */}
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                      <ShieldCheck size={13} />
                      <span>{lang === "tr" ? "Doğrulanmış Randevu" : "Verified Booking"}</span>
                      {rev.service_name && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-slate-500 dark:text-slate-400 font-normal">{rev.service_name}</span>
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

      {/* Posts Feed */}
      <div className="pt-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 px-2">
          {lang === "tr" ? "İşletme Paylaşımları" : "Posts"}
        </h2>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 rounded-3xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50">
            {lang === "tr" ? "Henüz gönderi yok." : "No posts yet."}
          </div>
        ) : (
          <PostGrid
            posts={posts}
            onPostClick={handlePostClick}
            isLoading={false}
          />
        )}
      </div>

      {/* Post Modal */}
      <PostModal
        post={selectedPost}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onLikeToggle={handleLikeToggle}
        onAddComment={handleAddComment}
      />

      {/* Review Modal */}
      {reviewsData.eligible_appointment_id && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          appointmentId={reviewsData.eligible_appointment_id}
          businessName={tenant.name}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
