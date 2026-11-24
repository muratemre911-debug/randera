"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  inspectTrMobile,
  trMobileErrorMessage,
  TR_MOBILE_PLACEHOLDER,
} from "@/lib/phone";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ui/Toast";
import Presence from "@/components/ui/Presence";
import { useFavorites } from "@/lib/useFavorites";

export default function ProfilePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { favoriteIds } = useFavorites();
  const { toast } = useToast();

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
        const [{ data: profile }, { count }] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, phone, avatar_url, role")
            .eq("id", user.id)
            .single(),
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", user.id),
        ]);

        if (profile) {
          setFullName(profile.full_name || "");
          setPhone(profile.phone || "");
          setAvatarUrl(profile.avatar_url || "");
          setRole(profile.role || null);
        }
        setAppointmentCount(count ?? 0);
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast(
        lang === "tr"
          ? "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın."
          : "User not found. Please sign in again.",
        "error",
      );
      setSaving(false);
      return;
    }

    // Telefon, fotoğraftan önce doğrulanır: numara reddedilirse boşuna
    // fotoğraf yüklenmesin. Biçim + "bir numara yalnızca bir hesapta"
    // kontrolü sunucuda yapılır (başka profilleri okumak gerekir, /api/phone).
    let normalizedPhone: string | null = null;

    if (!phone.trim()) {
      if (role === "customer") {
        toast(t("profile.phone_required"), "error");
        setSaving(false);
        return;
      }
    } else {
      const check = inspectTrMobile(phone);
      if (!check.ok) {
        toast(trMobileErrorMessage(check.issue, lang), "error");
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
        toast(
          phoneData?.error ||
            (lang === "tr"
              ? "Telefon numarası kaydedilemedi."
              : "Could not save the phone number."),
          "error",
        );
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
        toast(t("profile.photo_failed"), "error");
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
      toast(t("profile.phone_failed"), "error");
    } else {
      setAvatarUrl(finalAvatarUrl);
      setAvatarFile(null);
      setAvatarPreview("");
      toast(t("profile.saved"), "success");

      // Sidebar'daki isim + profil fotoğrafı anında güncellensin
      window.dispatchEvent(
        new CustomEvent("randera:profile-updated", {
          detail: { full_name: fullName, avatar_url: finalAvatarUrl },
        }),
      );
    }

    setSaving(false);
  };

  const roleLabel =
    role === "owner"
      ? lang === "tr"
        ? "İşletme sahibi"
        : "Business owner"
      : role === "staff"
        ? lang === "tr"
          ? "Ekip üyesi"
          : "Team member"
        : lang === "tr"
          ? "Randera üyesi"
          : "Randera member";

  return (
    <div className="mx-auto w-full max-w-3xl px-1 py-4 sm:px-2 sm:py-7">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Presence
          swapKey={fetching ? "loading" : "form"}
          enterClassName="animate-fade-rise-in"
          exitClassName="animate-fade-rise-out"
        >
          {fetching ? (
            <div className="space-y-4">
              <section className="flex items-center gap-4 rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-slate-900">
                <Skeleton className="h-24 w-24 shrink-0 rounded-[26px]" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-40 max-w-full" />
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-4 w-36 max-w-full" />
                </div>
              </section>
              <section className="space-y-5 rounded-[30px] border border-slate-200/80 bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-slate-900">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)] sm:p-6 dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[26px] bg-slate-100 text-3xl font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
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
                      className="absolute -bottom-1.5 -right-1.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-[3px] border-white bg-[var(--brand)] text-white shadow-md transition hover:scale-105 dark:border-slate-900"
                    >
                      <Camera size={17} strokeWidth={2.3} />
                    </label>
                    <input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                      {fullName || (lang === "tr" ? "Adını ekle" : "Add your name")}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                      {roleLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <Link
                    href="/my-appointments"
                    className="inline-flex items-center gap-1.5 rounded-lg transition hover:text-slate-950 dark:hover:text-white"
                  >
                    <CalendarDays size={17} className="text-slate-400" />
                    <span className="font-extrabold text-slate-950 dark:text-white">
                      {appointmentCount}
                    </span>
                    {lang === "tr" ? "Randevu" : "Appointments"}
                  </Link>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <Link
                    href="/favorites"
                    className="inline-flex items-center gap-1.5 rounded-lg transition hover:text-slate-950 dark:hover:text-white"
                  >
                    <Heart size={17} className="text-slate-400" />
                    <span className="font-extrabold text-slate-950 dark:text-white">
                      {favoriteIds.length}
                    </span>
                    {lang === "tr" ? "Favori" : "Favorites"}
                  </Link>
                </div>
              </section>

              <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)] sm:p-6 dark:border-white/10 dark:bg-slate-900">
                <h2 className="mb-5 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  {lang === "tr" ? "Kişisel Bilgiler" : "Personal information"}
                </h2>

                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-[15px] font-bold text-slate-900 dark:text-white"
                    >
                      {t("profile.name")}
                    </label>
                    <div className="relative">
                      <UserRound
                        size={19}
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
                        className="h-[58px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[16px] font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-900/5 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:bg-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-[15px] font-bold text-slate-900 dark:text-white"
                    >
                      {t("profile.phone")}
                    </label>
                    <div className="relative">
                      <Phone
                        size={19}
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
                        className="h-[58px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[16px] font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-900/5 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:bg-slate-800"
                      />
                    </div>
                    <p className="mt-2.5 flex items-start gap-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
                      <ShieldCheck
                        size={17}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      <span>{t("profile.phone_note")}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--brand)] px-5 py-4 text-[16px] font-extrabold text-white shadow-[0_8px_20px_var(--brand-shadow)] transition hover:bg-[var(--brand-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {t("profile.saving")}
                    </>
                  ) : (
                    <>
                      <Check size={19} strokeWidth={2.8} />
                      {t("profile.save")}
                    </>
                  )}
                </button>
              </section>
            </div>
          )}
        </Presence>
      </form>

      <div className="mt-4 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-slate-900">
        {(role === "owner" || role === "staff") && (
          <Link
            href="/dashboard"
            className="flex min-h-[88px] items-center gap-4 border-b border-slate-200 px-5 py-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70 sm:px-6"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
              <LayoutDashboard size={23} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold text-slate-900 dark:text-white">
                {t("profile.back_to_business")}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                {lang === "tr"
                  ? "Randevu ve takvim yönetimine geç"
                  : "Manage appointments and your calendar"}
              </span>
            </span>
            <ChevronRight size={21} className="shrink-0 text-slate-400" />
          </Link>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[88px] w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition hover:bg-rose-50/70 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-400/[0.06] sm:px-6"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
            <LogOut size={23} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-rose-600 dark:text-rose-300">
              {loggingOut ? t("profile.logging_out") : t("nav.logout")}
            </span>
            <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
              {lang === "tr"
                ? "Mevcut oturumu sonlandır"
                : "End your current session"}
            </span>
          </span>
          <ChevronRight size={21} className="shrink-0 text-rose-500" />
        </button>
      </div>
    </div>
  );
}
