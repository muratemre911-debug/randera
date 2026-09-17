"use client";

import { useEffect, useState, useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { PostGrid, PostGridSkeleton } from "@/components/PostGrid";
import { PostModal } from "@/components/PostModal";
import { Post, Tenant } from "@/types";

interface PostWithTenant extends Post {
  tenant?: Pick<Tenant, "id" | "name" | "profile_image_url">;
}

export default function IceriklerPage() {
  const supabase = createClient();
  const { lang } = useLanguage();

  const [posts, setPosts] = useState<PostWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPost, setSelectedPost] = useState<PostWithTenant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setTenantId(profile.tenant_id);

    const res = await fetch(`/api/posts?tenant_id=${profile.tenant_id}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      const tenantRes = await fetch(`/api/tenant/${profile.tenant_id}`);
      const tenantData = await tenantRes.json();
      const tenant = tenantData?.tenant;
      const postsWithTenant = data.map((post: Post) => ({
        ...post,
        tenant: tenant ? { id: tenant.id, name: tenant.name, profile_image_url: tenant.profile_image_url } : undefined,
      }));
      setPosts(postsWithTenant);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !tenantId) return;
    setUploading(true);
    setMessage({ type: "", text: "" });

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `public/${tenantId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        setMessage({ type: "error", text: lang === "tr" ? "Fotoğraf yüklenirken hata oluştu." : "Error uploading photo." });
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from("posts").getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, description }),
      });
      const resData = await res.json();
      if (!res.ok || resData.error) {
        setMessage({ type: "error", text: resData.error || (lang === "tr" ? "Gönderi oluşturulurken hata." : "Error creating post.") });
      } else {
        setDescription("");
        setFile(null);
        setPreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMessage({ type: "success", text: lang === "tr" ? "İçerik başarıyla eklendi." : "Content added successfully." });
        fetchPosts();
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const [featuredPostIds, setFeaturedPostIds] = useState<string[]>([]);

  useEffect(() => {
    if (tenantId) {
      const saved = localStorage.getItem(`tenant_featured_posts_${tenantId}`);
      if (saved) {
        try {
          setFeaturedPostIds(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [tenantId]);

  const handleToggleFeature = (postId: string) => {
    setFeaturedPostIds((prev) => {
      const next = prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId];
      if (tenantId) {
        localStorage.setItem(`tenant_featured_posts_${tenantId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === "tr" ? "Bu içeriği silmek istediğinize emin misiniz?" : "Are you sure you want to delete this post?")) return;
    const res = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchPosts();
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {lang === "tr" ? "İçerikler & Galeri" : "Posts & Gallery"}
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
          {lang === "tr" ? "İşletme profilinizde ve vitrininizde görünecek fotoğraf ve açıklamaları yönetin." : "Manage photos and descriptions for your business showcase."}
        </p>
      </div>

      {/* İki Sütunlu Yerleşim */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sol Sütun: Yeni fotoğraf yükleme alanı ve açıklama formu */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {lang === "tr" ? "Yeni Fotoğraf Yükle" : "Upload New Photo"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {message.text && (
                <div className={`p-3.5 rounded-2xl text-sm font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50" : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50"}`}>
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {lang === "tr" ? "Fotoğraf Seçimi" : "Select Photo"}
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-slate-800/50 transition-all group"
                >
                  {preview ? (
                    <img src={preview} alt="Önizleme" className="max-h-52 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-indigo-600 transition-colors py-4">
                      <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <ImagePlus size={24} />
                      </div>
                      <span className="text-sm font-bold">{lang === "tr" ? "Görsel seçmek için tıklayın" : "Click to choose photo"}</span>
                      <span className="text-xs text-slate-400">JPG, PNG, WEBP</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {lang === "tr" ? "Açıklama" : "Description"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={lang === "tr" ? "Bu çalışma veya model hakkında açıklama ekleyin..." : "Write a description..."}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:bg-slate-800 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
              >
                {uploading ? (lang === "tr" ? "Yükleniyor..." : "Uploading...") : (lang === "tr" ? "Fotoğrafı Yayınla" : "Publish Photo")}
              </button>
            </form>
          </div>
        </div>

        {/* Sağ Sütun: Yüklenen fotoğrafların yer aldığı 3'lü/4'lü Instagram tarzı grid galeri */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {lang === "tr" ? "Vitrin / Galeri Fotoğrafları" : "Showcase Photos"}
            </h2>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {posts.length} {lang === "tr" ? "Fotoğraf" : "Photos"}
            </span>
          </div>

          {loading ? (
            <PostGridSkeleton />
          ) : (
            <PostGrid
              posts={posts}
              onPostClick={handlePostClick}
              onDelete={handleDelete}
              onToggleFeature={handleToggleFeature}
              featuredPostIds={featuredPostIds}
              columns={3}
              isLoading={false}
            />
          )}
        </div>
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