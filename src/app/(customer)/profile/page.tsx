"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Camera, LogOut, LayoutDashboard } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  inspectTrMobile,
  trMobileErrorMessage,
  TR_MOBILE_PLACEHOLDER,
} from "@/lib/phone";

export default function ProfilePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const supabase = createClient();

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url, role")
          .eq("id", user.id)
          .single();

        if (profile) {
          setFullName(profile.full_name || "");
          setPhone(profile.phone || "");
          setAvatarUrl(profile.avatar_url || "");
          setRole(profile.role || null);
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage({
        type: "error",
        text: "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.",
      });
      setSaving(false);
      return;
    }

    // Telefon, fotoğraftan önce doğrulanır: numara reddedilirse boşuna
    // fotoğraf yüklenmesin. Biçim + "bir numara yalnızca bir hesapta"
    // kontrolü sunucuda yapılır (başka profilleri okumak gerekir, /api/phone).
    let normalizedPhone: string | null = null;

    if (!phone.trim()) {
      if (role === "customer") {
        setMessage({ type: "error", text: t("profile.phone_required") });
        setSaving(false);
        return;
      }
    } else {
      const check = inspectTrMobile(phone);
      if (!check.ok) {
        setMessage({ type: "error", text: trMobileErrorMessage(check.issue, lang) });
        setSaving(false);
        return;
      }

      const phoneRes = await fetch("/api/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const phoneData = await phoneRes.json().catch(() => ({}));

      if (!phoneRes.ok) {
        setMessage({
          type: "error",
          text: phoneData?.error || "Telefon numarası kaydedilemedi.",
        });
        setSaving(false);
        return;
      }

      normalizedPhone = phoneData?.phone || check.phone;
    }

    let finalAvatarUrl = avatarUrl;

    if (avatarFile) {
      const fileExt = avatarFile.name.split(".").pop() || "png";
      const filePath = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        setMessage({
          type: "error",
          text: t("profile.photo_failed"),
        });
        setSaving(false);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      finalAvatarUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: normalizedPhone, avatar_url: finalAvatarUrl })
      .eq("id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      setMessage({
        type: "error",
        text: t("profile.phone_failed"),
      });
    } else {
      setAvatarUrl(finalAvatarUrl);
      setAvatarFile(null);
      setAvatarPreview("");
      setMessage({
        type: "success",
        text: t("profile.saved"),
      });

      // Sidebar'daki isim + profil fotoğrafı anında güncellensin
      window.dispatchEvent(
        new CustomEvent("randera:profile-updated", {
          detail: { full_name: fullName, avatar_url: finalAvatarUrl },
        }),
      );
    }

    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 md:px-0">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        {t("profile.title")}
      </h1>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm">
        {fetching ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {message.text && (
              <div
                role="alert"
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
                      alt={t("profile.photo_alt")}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    fullName.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                <label
                  htmlFor="avatar"
                  aria-label={t("profile.photo_add")}
                  className="absolute bottom-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                  <Camera size={18} />
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
                {t("profile.photo_add")}
              </p>
            </div>

            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("profile.name")}
              </label>
              <input
                id="fullName"
                name="name"
                autoComplete="name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("profile.name_placeholder")}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("profile.phone")}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={TR_MOBILE_PLACEHOLDER}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {t("profile.phone_note")}
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-70 flex justify-center items-center mt-4"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {t("profile.saving")}
                </>
              ) : (
                t("profile.save")
              )}
            </button>
          </form>
        )}
      </div>

      {/* Ekstra İşlemler & Çıkış Yap */}
      <div className="mt-6 flex flex-col gap-3">
        {(role === "owner" || role === "staff") && (
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200 hover:from-indigo-600 hover:to-purple-700 dark:shadow-indigo-950/40 py-3.5 px-4 text-sm font-bold transition-all active:scale-[0.98]"
          >
            <LayoutDashboard size={18} strokeWidth={2.2} />
            <span>{t("profile.back_to_business")}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 border border-red-200/70 dark:border-red-500/20 py-3.5 px-4 text-sm font-bold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-60"
        >
          <LogOut size={18} strokeWidth={2.2} />
          <span>
            {loggingOut ? t("profile.logging_out") : t("nav.logout")}
          </span>
        </button>
      </div>
    </div>
  );
}
