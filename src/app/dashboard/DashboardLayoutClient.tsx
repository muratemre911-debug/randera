"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Calendar,
  History,
  Wrench,
  Users,
  UserCog,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  Image as ImageIcon,
  Search,
  Command,
  Compass,
  Lock,
  Mail,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import { SUPER_ADMIN_EMAILS } from "@/lib/admin";
import {
  getMembership,
  formatRemaining,
  type MembershipInfo,
} from "@/lib/membership";

import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";
import { SHELL } from "@/components/layout/shell";
import SwipePager from "@/components/layout/SwipePager";
import UserAvatar, { getDisplayName } from "@/components/layout/UserAvatar";
import { preventFocusScroll } from "@/lib/preventFocusScroll";

/**
 * Panelde parmakla geçiş yapılabilen sekmeler.
 * Alt navigasyon çubuğunda görünen sekmelerle BİREBİR aynı sıradadır; böylece
 * kaydırma hareketi ile sekme göstergesi hep tutarlı kalır. Menü sayfasından
 * açılan diğer sayfalar (İçerikler, Geçmiş Randevular, Ayarlar) kaydırma
 * kapsamı dışındadır — alt çubukta sekmesi yoktur.
 */
const DASHBOARD_SWIPE_TABS = [
  { href: "/dashboard" },
  { href: "/dashboard/takvim" },
  { href: "/dashboard/hizmetler" },
  { href: "/dashboard/ekip" },
  { href: "/dashboard/musteriler" },
];

/**
 * Mobil "Menü" çekmecesinde listelenen sayfalar (alt çubukta sekmesi
 * olmayanlar). Görünürlük kuralı burada tekrarlanmaz: liste navItems'ten
 * süzülür, böylece "yalnızca sahip" işaretli bir sayfa (ör. İçerikler)
 * çekmecede de otomatik olarak gizlenir.
 */
const DRAWER_HREFS = [
  "/dashboard/icerikler",
  "/dashboard/gecmis-randevular",
  "/dashboard/ayarlar",
];

const navItems: {
  i18nKey: string;
  href: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
}[] = [
  { i18nKey: "nav.overview", href: "/dashboard", icon: LayoutDashboard },
  { i18nKey: "nav.calendar", href: "/dashboard/takvim", icon: Calendar },
  {
    i18nKey: "nav.past_appointments",
    href: "/dashboard/gecmis-randevular",
    icon: History,
  },
  { i18nKey: "nav.services", href: "/dashboard/hizmetler", icon: Wrench },
  {
    i18nKey: "nav.team",
    href: "/dashboard/ekip",
    icon: UserCog,
    ownerOnly: true,
  },
  { i18nKey: "nav.posts", href: "/dashboard/icerikler", icon: ImageIcon, ownerOnly: true },
  { i18nKey: "nav.customers", href: "/dashboard/musteriler", icon: Users },
  { i18nKey: "nav.settings", href: "/dashboard/ayarlar", icon: Settings },
];

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t, lang, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  // Ekip yönetimi yalnızca işletme sahibine görünür
  const [userRole, setUserRole] = useState<string | null>(null);
  // İşletme üyeliği (deneme/ücretli süre) — süper admin kapattıysa panel bloke edilir
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  /**
   * İşletme durumu. RLS, askıya alınmış işletmenin satırını personelden
   * gizlediği için istemciden okunamıyor; bu yüzden oturuma özel
   * `/api/me/tenant-status` ucundan alınır. Aksi halde askıya alınmış bir
   * işletmenin personeli "boş panel" görüyordu.
   */
  const [tenantState, setTenantState] = useState<
    "unknown" | "ok" | "none" | "missing"
  >("unknown");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Kalan gün rozetinin renkleri
  const membershipBadgeClass = (kind: MembershipInfo["kind"]) =>
    kind === "unlimited"
      ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300"
      : kind === "active"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400"
        : kind === "trial"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400";

  // Dış pencere ve shell konteynerlerinin kaymasını önle (header mobilde yukarı kaçmasın)
  useEffect(() => {
    const lockExternalScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
      if (columnRef.current && columnRef.current.scrollTop !== 0) {
        columnRef.current.scrollTop = 0;
      }
      if (rootRef.current && rootRef.current.scrollTop !== 0) {
        rootRef.current.scrollTop = 0;
      }
    };
    window.addEventListener("scroll", lockExternalScroll, { passive: true });
    return () => window.removeEventListener("scroll", lockExternalScroll);
  }, []);

  // Close mobile bottom sheet and reset scroll when route changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rota değişince mobil menüyü kapat
    setMobileMenuOpen(false);
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    if (columnRef.current) {
      columnRef.current.scrollTop = 0;
    }
    if (rootRef.current) {
      rootRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  // Keyboard shortcut Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === "Escape" && cmdOpen) {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cmdOpen]);

  useEffect(() => {
    // Fetch user
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, tenant_id, role")
          .eq("id", user.id)
          .single();
        setUserFullName(profile?.full_name ?? null);
        setUserAvatarUrl(profile?.avatar_url ?? null);
        setUserRole(profile?.role ?? null);

        // Üyelik/askıya alınma durumu: service-role ile okunur, böylece
        // askıya alınmış işletmenin personeli de doğru ekranı görür.
        if (profile?.tenant_id) {
          try {
            const res = await fetch("/api/me/tenant-status", {
              cache: "no-store",
            });
            if (res.ok) {
              const status = await res.json();
              if (status.state === "ok" && status.tenant) {
                setTenantState("ok");
                setMembership(
                  getMembership({
                    membership_status: status.tenant.membershipStatus,
                    trial_ends_at: status.tenant.trialEndsAt,
                    membership_ends_at: status.tenant.membershipEndsAt,
                  }),
                );
              } else if (status.state === "none" || status.state === "missing") {
                setTenantState(status.state);
              }
            }
          } catch {
            /* durum okunamazsa mevcut akış devam eder */
          }
        } else {
          setTenantState("none");
        }
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const visibleNavItems = navItems.filter(
    (item) => !item.ownerOnly || userRole === "owner",
  );

  /**
   * Hesap türü etiketi. İşletme sahibinde "İşletme Hesabı", ekip üyesinde
   * "Eleman Hesabı" görünür; profil okunana kadar (null) etiket gizlenir ki
   * yanlış etiket bir anlık da olsa görünmesin.
   */
  const accountLabelKey =
    userRole === null
      ? null
      : userRole === "owner"
        ? "nav.business_account"
        : "nav.staff_account";

  const isSuperAdminUser = Boolean(
    userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase()),
  );
  const membershipClosed =
    membership !== null &&
    (membership.kind === "suspended" || membership.kind === "expired");

  // İşletme silinmişse / hesap bir işletmeye bağlı değilse net bir ekran göster
  // (boş panel yerine). Süper admin muaf tutulur.
  if (
    (tenantState === "missing" || tenantState === "none") &&
    !isSuperAdminUser
  ) {
    const removed = tenantState === "missing";
    return (
      <div className="page-fill flex items-center justify-center bg-slate-50 px-4 dark:bg-[#0B0D14]">
        <div className="w-full max-w-md rounded-[28px] border border-amber-200/70 bg-amber-50/70 p-6 text-center dark:border-amber-500/25 dark:bg-amber-950/25">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white shadow-sm dark:bg-slate-900">
            <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            {t(removed ? "dashboard.tenant_missing_title" : "dashboard.no_tenant_title")}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t(removed ? "dashboard.tenant_missing_desc" : "dashboard.no_tenant_desc")}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-6 items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition active:scale-95"
            >
              <RefreshCw size={16} />
              {t("dashboard.tenant_missing_retry")}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-6 items-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Üyelik kapatıldıysa / süresi dolduysa panel bloke edilir (süper admin hariç)
  if (membershipClosed && membership && !isSuperAdminUser) {
    const suspended = membership.kind === "suspended";
    return (
      <div className="page-fill flex items-center justify-center bg-slate-50 p-4 dark:bg-[#0B0D14]">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200/80 bg-white/80 p-8 text-center shadow-xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-500/10">
            <Lock size={28} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {suspended
              ? lang === "tr"
                ? "İşletme üyeliğiniz kapatıldı"
                : "Your business membership is closed"
              : lang === "tr"
                ? "Üyelik süreniz doldu"
                : "Your membership expired"}
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            {lang === "tr"
              ? suspended
                ? "Panele erişim yönetici tarafından kapatıldı. Yeniden açmak için bizimle iletişime geçin; randevu ve müşteri verileriniz silinmedi."
                : "Deneme/üyelik süreniz bitti. Devam etmek için size uygun paketi yükleyebiliriz; verileriniz silinmedi."
              : suspended
                ? "Access was closed by the administrator. Contact us to reopen; your data is safe."
                : "Your trial/membership has ended. Contact us to continue; your data is safe."}
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <a
              href={`mailto:${SUPER_ADMIN_EMAILS[0]}?subject=${encodeURIComponent(
                "İşletme üyeliği hakkında",
              )}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-indigo-500 active:scale-95"
            >
              <Mail size={16} />
              {lang === "tr" ? "İletişime Geç" : "Contact us"}
            </a>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LayoutDashboard size={16} />
              {lang === "tr" ? "Keşfet'e dön" : "Back to discover"}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut size={16} />
              {lang === "tr" ? "Çıkış Yap" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={SHELL.root}>
      {/* Animated Mesh Gradient Backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-purple-900/20 dark:mix-blend-screen" />
      <div
        className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-indigo-900/20 dark:mix-blend-screen"
        style={{ animationDelay: "2s" }}
      />
      <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-pink-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob-slow dark:bg-pink-900/20 dark:mix-blend-screen" />

      {/* Desktop Floating Sidebar (hidden on mobile) */}
      <aside className={SHELL.sidebar}>
        {/* Logo */}
        <div className="flex h-20 items-center justify-between px-6 pt-2">
          <DynamicLogoLink className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 border border-gray-200/50 dark:border-slate-700/50">
              <img
                src="/logo-light.png"
                alt="Randera Logo"
                className="h-full w-full object-cover dark:hidden"
              />
              <img
                src="/logo-dark.png"
                alt="Randera Logo"
                className="hidden h-full w-full object-cover dark:block"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-slate-100">
              Randera
            </span>
          </DynamicLogoLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-95 ${
                  isActive
                    ? "bg-white/90 text-indigo-700 shadow-sm backdrop-blur-xl dark:bg-slate-800/90 dark:text-indigo-400 dark:shadow-black/20"
                    : "text-gray-500 hover:bg-white/50 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                }`}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {t(item.i18nKey)}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 pb-4">
          <div className="flex flex-col gap-2 rounded-2xl p-3 text-sm transition-colors bg-white/30 dark:bg-slate-800/30">
            {/* Customer area shortcut */}
            <Link
              href="/discover"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 px-4 py-2 text-[13px] font-bold text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10 mb-2"
            >
              <Compass size={16} />
              <span className="truncate">{t("nav.switch_to_customer")}</span>
            </Link>

            <div className="flex items-center gap-3">
              <UserAvatar
                src={userAvatarUrl}
                fullName={userFullName}
                email={userEmail}
              />
              <div className="flex-1 truncate">
                <p
                  title={userEmail || undefined}
                  className="font-semibold tracking-tight text-gray-800 dark:text-slate-200 truncate"
                >
                  {getDisplayName(userFullName, userEmail, t("header.loading"))}
                </p>
                {accountLabelKey && (
                  <p className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">
                    {t(accountLabelKey)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <LogOut size={16} />
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div ref={columnRef} className={SHELL.column}>
        {/* Floating Header */}
        <header className={SHELL.header}>
          {/* Mobile Logo Brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <DynamicLogoLink className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-xs border border-gray-200/50 dark:border-slate-700/50">
                <img
                  src="/logo-light.png"
                  alt="Randera Logo"
                  className="h-full w-full object-cover dark:hidden"
                />
                <img
                  src="/logo-dark.png"
                  alt="Randera Logo"
                  className="hidden h-full w-full object-cover dark:block"
                />
              </div>
              <span className="hidden sm:inline text-base font-black tracking-tight text-gray-800 dark:text-slate-100">
                Randera
              </span>
            </DynamicLogoLink>
          </div>
          <div className="hidden lg:block" />

          {/* Command Palette Trigger in Header (Hidden on mobile) */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs text-gray-500 dark:text-slate-400 font-medium transition-colors"
          >
            <Search size={15} />
            <span>
              {lang === "tr"
                ? "Hızlı ara veya komutlar..."
                : "Quick search or commands..."}
            </span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-800 text-[10px] font-mono font-bold text-gray-600 dark:text-slate-300 shadow-xs border border-gray-200 dark:border-slate-700">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-4">
            {/* Kalan deneme/üyelik süresi (yalnızca işletme sahibine görünür) */}
            {membership && userRole === "owner" && (
              <span
                title={formatRemaining(membership, lang === "tr" ? "tr" : "en")}
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${membershipBadgeClass(
                  membership.kind,
                )}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {formatRemaining(membership, lang === "tr" ? "tr" : "en")}
              </span>
            )}

            {/* Customer area shortcut (business owners can also browse as customers) */}
            <Link
              href="/discover"
              title={t("nav.customer_area")}
              className="lg:hidden rounded-full p-2 sm:p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <Search size={18} strokeWidth={2.5} />
            </Link>

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="rounded-full px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {lang === "tr" ? "TR" : "EN"}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-full p-2 sm:p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {theme === "light" ? (
                <Moon size={18} strokeWidth={2.5} />
              ) : (
                <Sun size={18} strokeWidth={2.5} />
              )}
            </button>

            {/* Notification bell */}
            <NotificationBell />
          </div>
        </header>

        {/* Sayfa içeriği — alt navigasyon sekmeleri arasında parmakla geçiş */}
        <SwipePager
          ref={mainRef}
          tabs={DASHBOARD_SWIPE_TABS}
          className={SHELL.main}
          onMouseDown={preventFocusScroll}
        >
          {children}
        </SwipePager>
      </div>

      {/* Mobile Bottom Navigation Bar (Instagram / TikTok / YouTube style) */}
      <nav className={SHELL.bottomNav}>
        <div className={SHELL.bottomNavInner}>
          {/* 1. Özet */}
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 transition-all duration-200 active:scale-90 ${
              pathname === "/dashboard"
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <LayoutDashboard
              size={21}
              strokeWidth={pathname === "/dashboard" ? 2.5 : 1.8}
            />
            <span className="text-[9.5px] sm:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full text-center">
              {t("nav.overview")}
            </span>
          </Link>

          {/* 2. Takvim */}
          <Link
            href="/dashboard/takvim"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 transition-all duration-200 active:scale-90 ${
              pathname.startsWith("/dashboard/takvim")
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Calendar
              size={21}
              strokeWidth={pathname.startsWith("/dashboard/takvim") ? 2.5 : 1.8}
            />
            <span className="text-[9.5px] sm:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full text-center">
              {t("nav.calendar")}
            </span>
          </Link>

          {/* 3. Hizmetler */}
          <Link
            href="/dashboard/hizmetler"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 transition-all duration-200 active:scale-90 ${
              pathname.startsWith("/dashboard/hizmetler")
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Wrench
              size={21}
              strokeWidth={
                pathname.startsWith("/dashboard/hizmetler") ? 2.5 : 1.8
              }
            />
            <span className="text-[9.5px] sm:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full text-center">
              {t("nav.services")}
            </span>
          </Link>

          {/* 4. Ekip (Yalnızca işletme sahibi) */}
          {(userRole === "owner" || pathname.startsWith("/dashboard/ekip")) && (
            <Link
              href="/dashboard/ekip"
              className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 transition-all duration-200 active:scale-90 ${
                pathname.startsWith("/dashboard/ekip")
                  ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                  : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <UserCog
                size={21}
                strokeWidth={
                  pathname.startsWith("/dashboard/ekip") ? 2.5 : 1.8
                }
              />
              <span className="text-[9.5px] sm:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full text-center">
                {t("nav.team")}
              </span>
            </Link>
          )}

          {/* 5. Müşteriler */}
          <Link
            href="/dashboard/musteriler"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 transition-all duration-200 active:scale-90 ${
              pathname.startsWith("/dashboard/musteriler")
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Users
              size={21}
              strokeWidth={
                pathname.startsWith("/dashboard/musteriler") ? 2.5 : 1.8
              }
            />
            <span className="text-[9.5px] sm:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full text-center">
              {t("nav.customers")}
            </span>
          </Link>

          {/* 6. Menü (More Drawer) */}
          {(() => {
            const isMoreActive =
              pathname.startsWith("/dashboard/icerikler") ||
              pathname.startsWith("/dashboard/gecmis-randevular") ||
              pathname.startsWith("/dashboard/ayarlar");
            return (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 transition-all duration-200 active:scale-90 ${
                  isMoreActive || mobileMenuOpen
                    ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                    : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                }`}
              >
                <Menu
                  size={21}
                  strokeWidth={isMoreActive || mobileMenuOpen ? 2.5 : 1.8}
                />
                <span className="text-[9.5px] sm:text-[10px] mt-1 tracking-tight leading-none truncate max-w-full text-center">
                  {lang === "tr" ? "Menü" : "Menu"}
                </span>
              </button>
            );
          })()}
        </div>
      </nav>

      {/* Mobile Bottom Sheet Menu (Drawer) */}
      {mobileMenuOpen && (
        <div data-no-swipe className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-t-[32px] border-t border-white/60 dark:border-slate-800 shadow-2xl p-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-slate-700 mx-auto" />

            {/* Business info & close */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={userAvatarUrl}
                  fullName={userFullName}
                  email={userEmail}
                  shape="rounded"
                  className="h-11 w-11 text-sm"
                />
                <div>
                  <p
                    title={userEmail || undefined}
                    className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]"
                  >
                    {getDisplayName(
                      userFullName,
                      userEmail,
                      lang === "tr" ? "İşletme Hesabı" : "Business Account",
                    )}
                  </p>
                  {accountLabelKey && (
                    <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {t(accountLabelKey)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation links inside drawer */}
            <div className="space-y-1.5">
              {DRAWER_HREFS.flatMap((href) => {
                const item = visibleNavItems.find((i) => i.href === href);
                return item ? [item] : [];
              }).map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40"
                        : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={20}
                        className={
                          isActive
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-gray-400"
                        }
                      />
                      <span>{t(item.i18nKey)}</span>
                    </div>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                        {lang === "tr" ? "Aktif" : "Active"}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Müşteri Hesabına Dön Linki */}
              <Link
                href="/discover"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
              >
                <Compass
                  size={20}
                  className="text-indigo-600 dark:text-indigo-400"
                />
                <span>{t("nav.switch_to_customer")}</span>
              </Link>
            </div>

            {/* Quick Actions & Logout */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-gray-100 dark:bg-slate-800/80 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                  <span>
                    {theme === "light"
                      ? lang === "tr"
                        ? "Koyu Mod"
                        : "Dark Mode"
                      : lang === "tr"
                        ? "Açık Mod"
                        : "Light Mode"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-gray-100 dark:bg-slate-800/80 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Command size={16} />
                  <span>{lang === "tr" ? "English" : "Türkçe"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold transition-colors"
              >
                <LogOut size={16} />
                <span>{t("nav.logout")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Cmd + K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-md animate-backdrop-in">
          <div className="relative w-full max-w-xl rounded-[28px] bg-white dark:bg-slate-900 border border-white/60 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-in">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-800">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder={
                  lang === "tr"
                    ? "Sayfa ara, işlem yap veya komut gir..."
                    : "Search pages or run commands..."
                }
                className="w-full bg-transparent text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
              />
              <kbd className="text-[10px] font-mono px-2 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-transparent">
              {/* Pages Section */}
              <div className="py-2">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  {lang === "tr" ? "Sayfalar" : "Pages"}
                </span>
                <div className="mt-1 space-y-0.5">
                  {visibleNavItems
                    .filter((item) =>
                      t(item.i18nKey)
                        .toLowerCase()
                        .includes(cmdQuery.toLowerCase()),
                    )
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          onClick={() => {
                            router.push(item.href);
                            setCmdOpen(false);
                            setCmdQuery("");
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              size={16}
                              className="text-indigo-600 dark:text-indigo-400"
                            />
                            <span>{t(item.i18nKey)}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {item.href}
                          </span>
                        </button>
                      );
                    })}

                  {[
                    {
                      href: "/discover",
                      icon: Compass,
                      label: t("nav.switch_to_customer"),
                    },
                  ]
                    .filter((item) =>
                      item.label.toLowerCase().includes(cmdQuery.toLowerCase()),
                    )
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          onClick={() => {
                            router.push(item.href);
                            setCmdOpen(false);
                            setCmdQuery("");
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              size={16}
                              className="text-emerald-600 dark:text-emerald-400"
                            />
                            <span>{item.label}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {item.href}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Quick Actions Section */}
              <div className="py-2">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  {lang === "tr" ? "Hızlı İşlemler" : "Actions"}
                </span>
                <div className="mt-1 space-y-0.5">
                  <button
                    onClick={() => {
                      toggleTheme();
                      setCmdOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {theme === "light" ? (
                        <Moon size={16} className="text-amber-500" />
                      ) : (
                        <Sun size={16} className="text-amber-400" />
                      )}
                      <span>
                        {lang === "tr"
                          ? "Temayı Değiştir (Açık / Koyu)"
                          : "Toggle Theme (Light / Dark)"}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      toggleLanguage();
                      setCmdOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Command size={16} className="text-purple-500" />
                      <span>
                        {lang === "tr"
                          ? "Dili Değiştir (TR / EN)"
                          : "Toggle Language"}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setCmdOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs sm:text-sm font-medium transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut size={16} />
                      <span>{t("nav.logout")}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Hint */}
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
              <span>
                {lang === "tr"
                  ? "Gitmek için tıklayın veya klavyeden seçin"
                  : "Click or use keyboard to navigate"}
              </span>
              <span className="font-mono">⌘K</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
