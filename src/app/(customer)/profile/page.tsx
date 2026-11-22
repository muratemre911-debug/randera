"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Camera,
  Check,
  CircleCheck,
  LayoutDashboard,
  LogOut,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
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
    <div className="mx-auto max-w-3xl px-1 py-4 sm:px-2 sm:py-7">
      <header className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            <Sparkles size={14} />
            {lang === "tr" ? "Hesap merkezi" : "Account center"}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("profile.title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
            {lang === "tr"
              ? "Bilgilerini güncel tut, randevu deneyimini kişiselleştir."
              : "Keep your details up to date and personalize your booking experience."}
          </p>
        </div>
        <div className="mb-1 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300 sm:flex">
          <UserRound size={22} strokeWidth={2.2} />
        </div>
      </header>

      <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/85 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_24px_70px_-30px_rgba(0,0,0,0.8)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-6 text-white sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-10 -top-24 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-48 w-48 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 backdrop-blur sm:flex">
              <ShieldCheck size={15} />
              {lang === "tr" ? "Güvenli hesap" : "Secure account"}
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-12 -right-5 h-32 w-32 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-16 right-9 h-32 w-32 rounded-full border border-white/10" />
        </div>

        {fetching ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600 dark:border-indigo-950 dark:border-t-indigo-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-10 mb-7 flex items-end gap-4">
              <div className="relative h-[92px] w-[92px] shrink-0">
                <div className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-[28px] border-4 border-white bg-gradient-to-br from-indigo-100 to-violet-200 text-3xl font-black text-indigo-700 shadow-xl shadow-slate-950/15 dark:border-slate-900 dark:from-indigo-400/30 dark:to-fuchsia-400/30 dark:text-white">
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
                  className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-[3px] border-white bg-slate-950 text-white shadow-lg transition duration-200 hover:scale-105 hover:bg-indigo-600 dark:border-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-200"
                >
                  <Camera size={16} strokeWidth={2.4} />
                </label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div className="min-w-0 pb-1">
                <p className="truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {fullName || (lang === "tr" ? "Adını ekle" : "Add your name")}
                </p>
              </div>
            </div>

            {message.text && (
              <div
                role="alert"
                className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                }`}
              >
                {message.type === "success" ? (
                  <CircleCheck size={18} className="shrink-0" />
                ) : (
                  <ShieldCheck size={18} className="shrink-0" />
                )}
                {message.text}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {t("profile.name")}
                </label>
                <div className="relative">
                  <UserRound
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="fullName"
                    name="name"
                    autoComplete="name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("profile.name_placeholder")}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-[15px] font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-950/45 dark:text-white dark:hover:border-white/20 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {t("profile.phone")}
                </label>
                <div className="relative">
                  <Phone
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={TR_MOBILE_PLACEHOLDER}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-[15px] font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-950/45 dark:text-white dark:hover:border-white/20 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400 sm:mt-5">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-300" />
              <span>{t("profile.phone_note")}</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/30 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 dark:shadow-indigo-950/40"
            >
              {saving ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {t("profile.saving")}
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={2.8} />
                  {t("profile.save")}
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div
        className={`mt-4 grid gap-3 sm:mt-5 ${
          role === "owner" || role === "staff" ? "sm:grid-cols-2" : ""
        }`}
      >
        {(role === "owner" || role === "staff") && (
          <Link
            href="/dashboard"
            className="group flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-3.5 text-sm font-extrabold text-indigo-700 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 active:scale-[0.98] dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200 dark:hover:bg-indigo-400/15"
          >
            <LayoutDashboard size={18} strokeWidth={2.2} />
            <span>{t("profile.back_to_business")}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3.5 text-sm font-bold text-rose-600 transition duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/20 dark:bg-rose-400/[0.07] dark:text-rose-300 dark:hover:bg-rose-400/[0.12]"
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
