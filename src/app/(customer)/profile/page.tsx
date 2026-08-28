"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Camera } from "lucide-react";

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const supabase = createClient();

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url")
          .eq("id", user.id)
          .single();

        if (profile) {
          setFullName(profile.full_name || "");
          setPhone(profile.phone || "");
          setAvatarUrl(profile.avatar_url || "");
        }
      }
      setFetching(false);
    };

    getProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ type: "error", text: "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın." });
      setSaving(false);
      return;
    }

    let finalAvatarUrl = avatarUrl;

    if (avatarFile) {
      const fileExt = avatarFile.name.split(".").pop() || "png";
      const filePath = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });

      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        setMessage({ type: "error", text: "Fotoğraf yüklenirken bir hata oluştu." });
        setSaving(false);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      finalAvatarUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, avatar_url: finalAvatarUrl })
      .eq("id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      setMessage({ type: "error", text: "Profil güncellenirken bir hata oluştu." });
    } else {
      setAvatarUrl(finalAvatarUrl);
      setAvatarFile(null);
      setAvatarPreview("");
      setMessage({ type: "success", text: "Profiliniz başarıyla güncellendi." });
    }

    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 md:px-0">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Profilim</h1>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm">
        {fetching ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {message.text && (
              <div
                className={`p-4 rounded-xl ${
                  message.type === "success"
                    ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Profile Photo */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-24 w-24">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-3xl font-bold text-white shadow-md">
                  {avatarPreview || avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview || avatarUrl}
                      alt="Profil fotoğrafı"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    fullName.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                <label
                  htmlFor="avatar"
                  className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                  <Camera size={16} />
                </label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Profil fotoğrafı ekle
              </p>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ad Soyad
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adınız ve Soyadınız"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telefon Numarası
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-70 flex justify-center items-center mt-4"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Kaydediliyor...
                </>
              ) : (
                "Değişiklikleri Kaydet"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
