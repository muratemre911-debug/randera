"use client";

import { useEffect, useState, useRef } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

interface Post {
  id: string;
  tenant_id: string;
  image_url: string;
  description: string | null;
  created_at: string;
}

export default function IceriklerPage() {
  const supabase = createClient();
  const { lang } = useLanguage();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (Array.isArray(data)) setPosts(data);
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
        setMessage({ type: "error", text: "Fotoğraf yüklenirken hata oluştu." });
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
        setMessage({ type: "error", text: resData.error || "Gönderi oluşturulurken hata." });
      } else {
        setDescription("");
        setFile(null);
        setPreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMessage({ type: "success", text: "İçerik başarıyla eklendi." });
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
              // eslint-disable-next-line @next/next/no-img-element
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
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-indigo-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500">
            {lang === "tr" ? "Henüz içerik eklenmemiş." : "No posts yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {posts.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-2xl border border-white/50 bg-white/70 backdrop-blur-3xl dark:border-slate-700/50 dark:bg-slate-900/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.description || ""} className="h-48 w-full object-cover" />
                <div className="p-4">
                  <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                    {p.description || (lang === "tr" ? "Açıklama yok" : "No description")}
                  </p>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="mt-3 flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400"
                  >
                    <Trash2 size={14} />
                    {lang === "tr" ? "Sil" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
