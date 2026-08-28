"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { Calendar as CalendarIcon, MapPin, Building2, Loader2 } from "lucide-react";

export default function BusinessPage() {
  const { slug } = useParams();
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();

  const [tenant, setTenant] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    if (Array.isArray(postsData)) setPosts(postsData);

    setLoading(false);
  };

  if (loading) {
    return <div className="w-full h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 h-8 w-8" /></div>;
  }

  if (error || !tenant) {
    return <div className="w-full h-64 flex items-center justify-center text-red-500 dark:text-red-400 font-medium">{error}</div>;
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
            <div className="h-24 w-24 md:h-28 md:w-28 shrink-0 rounded-[24px] md:rounded-[28px] border-[5px] border-white dark:border-slate-900 shadow-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center">
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
      {posts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 px-2">
            {lang === 'tr' ? 'Gönderiler' : 'Posts'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {posts.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.description || ''} className="h-full w-full object-cover" />
                {p.description && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-xs text-white line-clamp-2">{p.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
