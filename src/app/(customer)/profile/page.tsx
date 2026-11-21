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
    <div className="max-w-2xl mx-auto px-4 py-6 md:px-0 md:py-10">
      <h1 className="mb-6 text-2xl font-black tracking-tight text-slate-900 dark:text-white lg:text-3xl lg:font-bold lg:tracking-normal lg:text-gray-900">
        {t("profile.title")}
      </h1>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)] lg:border-0 lg:p-6 lg:shadow-sm md:p-8">
        {fetching ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {message.text && (
              <div
                role="alert"
                className={`rounded-xl border p-4 ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400 lg:border-green-200 lg:bg-green-50 lg:text-green-700 dark:lg:border-green-800 dark:lg:bg-green-900/30 dark:lg:text-green-400"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 lg:border-red-200 lg:bg-red-50 lg:text-red-700 dark:lg:border-red-800 dark:lg:bg-red-900/30 dark:lg:text-red-400"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Profile Photo */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-24 w-24">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] text-3xl font-black text-[var(--brand-text)] lg:bg-gradient-to-br lg:from-indigo-400 lg:to-purple-500 lg:text-white lg:shadow-md">
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
                  className="absolute bottom-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[0_6px_16px_var(--brand-shadow)] transition-colors hover:bg-[var(--brand-strong)] lg:bg-blue-600 lg:shadow-md lg:hover:bg-blue-700"
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
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 lg:text-gray-500 dark:lg:text-gray-400">
                {t("profile.photo_add")}
              </p>
            </div>

            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300 lg:font-medium lg:text-gray-700 dark:lg:text-gray-300"
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
                className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-[var(--brand)] dark:border-slate-700 dark:bg-slate-800 dark:text-white lg:border-gray-200 lg:bg-gray-50 lg:focus:ring-blue-500 dark:lg:border-gray-700 dark:lg:bg-slate-800"
                required
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300 lg:font-medium lg:text-gray-700 dark:lg:text-gray-300"
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
                className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-[var(--brand)] dark:border-slate-700 dark:bg-slate-800 dark:text-white lg:border-gray-200 lg:bg-gray-50 lg:focus:ring-blue-500 dark:lg:border-gray-700 dark:lg:bg-slate-800"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 lg:text-gray-500 dark:lg:text-gray-400">
                {t("profile.phone_note")}
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--brand)] py-3.5 text-sm font-extrabold text-white shadow-[0_6px_16px_var(--brand-shadow)] transition-all active:scale-[0.98] disabled:opacity-70 lg:bg-blue-600 lg:py-3 lg:font-medium lg:shadow-none lg:hover:bg-blue-700"
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-soft)] px-4 py-3.5 text-sm font-extrabold text-[var(--brand-text)] transition-all active:scale-[0.98] lg:border-0 lg:bg-gradient-to-r lg:from-indigo-500 lg:to-purple-600 lg:text-white lg:shadow-md lg:shadow-indigo-200 lg:hover:from-indigo-600 lg:hover:to-purple-700 dark:lg:shadow-indigo-950/40"
          >
            <LayoutDashboard size={18} strokeWidth={2.2} />
            <span>{t("profile.back_to_business")}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3.5 text-sm font-bold text-rose-600 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 lg:border-red-200/70 lg:bg-red-50 lg:text-red-600 lg:hover:bg-red-100 dark:lg:border-red-500/20 dark:lg:bg-red-500/10 dark:lg:text-red-400 dark:lg:hover:bg-red-500/20"
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
