"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { Calendar as CalendarIcon, MapPin, Building2 } from "lucide-react";
import type { Tenant, Post } from "@/types";
import { BusinessPageSkeleton, Spinner } from "@/components/Skeleton";
import { PostGrid, PostGridSkeleton } from "@/components/PostGrid";
import { PostModal } from "@/components/PostModal";

interface PostWithTenant extends Post {
  tenant?: Pick<Tenant, "id" | "name" | "profile_image_url">;
}

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [posts, setPosts] = useState<PostWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPost, setSelectedPost] = useState<PostWithTenant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
      setError(lang === 'tr' ? "İşletme bulunamadı" : "Business not found");
      setLoading(false);
      return;
    }
    setTenant(tenantData);

    const postsRes = await fetch(`/api/posts?tenant_id=${tenantData.id}`);
    const postsData = await postsRes.json();
    if (Array.isArray(postsData)) {
      const postsWithTenant = postsData.map((post: Post) => ({
        ...post,
        tenant: { id: tenantData.id, name: tenantData.name, profile_image_url: tenantData.profile_image_url },
      }));
      setPosts(postsWithTenant);
    }

    setLoading(false);
  };

  const handleLikeToggle = async (postId: string) => {
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to toggle like");
  };

  const handleAddComment = async (postId: string, text: string) => {
    const res = await fetch(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("Failed to add comment");
  };

  const handlePostClick = (post: PostWithTenant) => {
    setSelectedPost(post);
    setModalOpen(true);
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
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12 font-sans">
      {/* Banner & Profile Container */}
      <div>
        {/* Cover Image Banner */}
        {tenant.cover_image_url ? (
          <div
            className="w-full h-48 md:h-56 bg-cover bg-center relative rounded-[28px] overflow-hidden shadow-sm"
            style={{ backgroundImage: `url(${tenant.cover_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/50" />
          </div>
        ) : (
          <div className="w-full h-48 md:h-56 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[28px] shadow-sm" />
        )}

        {/* Profile Section */}
        <div className="px-4 md:px-6 relative z-10">
          <div className="-mt-12 md:-mt-16 mb-4 ml-2 md:ml-4">
            {/* Profile Image / Avatar */}
            <div className="h-24 w-24 md:h-28 md:w-28 shrink-0 rounded-full border-[5px] border-white dark:border-slate-900 shadow-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center">
              {tenant.profile_image_url ? (
                <img src={tenant.profile_image_url} alt={tenant.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 size={40} className="text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
          </div>
          <div className="pb-2 ml-3 md:ml-5">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">{tenant.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 mt-3 text-sm font-medium">
              {tenant.sector && (
                <span className="px-3 py-1 bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold backdrop-blur-sm shadow-sm">{tenant.sector}</span>
              )}
              {(tenant.address || tenant.province || tenant.district) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-slate-400 shrink-0" />
                  {[tenant.address, tenant.district, tenant.province].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <button
              onClick={() => router.push(`/b/${slug}/randevu`)}
              className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-base font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <CalendarIcon size={20} />
              {lang === 'tr' ? 'Randevu Al' : 'Book Appointment'}
            </button>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 px-2">
          {lang === 'tr' ? 'Gönderiler' : 'Posts'}
        </h2>
        {posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500">
            {lang === 'tr' ? 'Henüz gönderi yok.' : 'No posts yet.'}
          </div>
        ) : (
          <PostGrid
            posts={posts}
            onPostClick={handlePostClick}
            isLoading={false}
          />
        )}
      </div>

      <PostModal
        post={selectedPost}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onLikeToggle={handleLikeToggle}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
