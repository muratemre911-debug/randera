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

  const handleDelete = async (id: string) => {
    if (!confirm(lang === "tr" ? "Bu içeriği silmek istediğinize emin misiniz?" : "Are you sure you want to delete this post?")) return;
    const res = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchPosts();
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {lang === "tr" ? "İçerikler" : "Posts"}
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
          {lang === "tr" ? "İşletme sayfanızda görünecek fotoğraf ve açıklamalar ekleyin." : "Add photos and descriptions to your business page."}
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/40 bg-white/60 p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-900/60 space-y-4">
        {message.text && (
          <div className={`p-4 rounded-xl ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            {lang === "tr" ? "Fotoğraf" : "Photo"}
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 p-8 hover:border-indigo-400 transition-colors"
          >
            {preview ? (
              <img src={preview} alt="Önizleme" className="max-h-56 rounded-xl object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <ImagePlus size={32} />
                <span className="text-sm font-medium">{lang === "tr" ? "Fotoğraf seç" : "Choose a photo"}</span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            {lang === "tr" ? "Açıklama" : "Description"}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={lang === "tr" ? "Bu gönderi hakkında bir açıklama yazın..." : "Write a description..."}
            className="w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full rounded-full bg-indigo-600 px-4 py-3 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
        >
          {uploading ? (lang === "tr" ? "Yükleniyor..." : "Uploading...") : (lang === "tr" ? "Yayınla" : "Publish")}
        </button>
      </form>

      {/* Posts grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {lang === "tr" ? "Gönderilerim" : "My Posts"}
        </h2>
        {loading ? (
          <PostGridSkeleton />
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500">
            {lang === "tr" ? "Henüz içerik eklenmemiş." : "No posts yet."}
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