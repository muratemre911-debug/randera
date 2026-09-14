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
  Settings,
  Bell,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Image as ImageIcon,
  Search,
  Command,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import NotificationBell from "@/components/NotificationBell";

import { useLanguage } from "@/context/LanguageContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";

const navItems = [
  { i18nKey: "nav.overview", href: "/dashboard", icon: LayoutDashboard },
  { i18nKey: "nav.calendar", href: "/dashboard/takvim", icon: Calendar },
  { i18nKey: "nav.past_appointments", href: "/dashboard/gecmis-randevular", icon: History },
  { i18nKey: "nav.services", href: "/dashboard/hizmetler", icon: Wrench },
  { i18nKey: "nav.posts", href: "/dashboard/icerikler", icon: ImageIcon },
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const isFirstRender = useRef(true);

  // Close mobile bottom sheet when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
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
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (prefersDark ? "dark" : "light");

    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    isFirstRender.current = false;

    // Fetch user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) return;
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-screen relative overflow-hidden bg-slate-50 dark:bg-[#0B0D14]">
      {/* Animated Mesh Gradient Backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-purple-900/20 dark:mix-blend-screen" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-indigo-900/20 dark:mix-blend-screen" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-pink-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob-slow dark:bg-pink-900/20 dark:mix-blend-screen" />

      {/* Desktop Floating Sidebar (hidden on mobile) */}
      <aside
        className="hidden lg:flex inset-y-4 left-4 z-50 w-64 flex-col rounded-3xl bg-white/60 backdrop-blur-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:static dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] select-none m-4"
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between px-6 pt-2">
          <DynamicLogoLink className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 border border-gray-200/50 dark:border-slate-700/50">
              <img src="/logo-light.png" alt="Randera Logo" className="h-full w-full object-cover dark:hidden" />
              <img src="/logo-dark.png" alt="Randera Logo" className="hidden h-full w-full object-cover dark:block" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-slate-100">
              Randera
            </span>
          </DynamicLogoLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white shadow-sm">
                {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex-1 truncate">
                <p className="font-semibold tracking-tight text-gray-800 dark:text-slate-200 truncate">
                  {userEmail || t("header.loading")}
                </p>
                <p className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">{t("nav.business_account")}</p>
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
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        {/* Floating Header */}
        <header className="sticky top-2 sm:top-4 z-40 mx-2 sm:mx-4 lg:mx-8 flex h-14 sm:h-16 items-center justify-between rounded-2xl sm:rounded-3xl border border-white/50 bg-white/60 backdrop-blur-3xl px-3.5 sm:px-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all select-none">
          {/* Mobile Logo Brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <DynamicLogoLink className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-xs border border-gray-200/50 dark:border-slate-700/50">
                <img src="/logo-light.png" alt="Randera Logo" className="h-full w-full object-cover dark:hidden" />
                <img src="/logo-dark.png" alt="Randera Logo" className="hidden h-full w-full object-cover dark:block" />
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
              {lang === "tr" ? "Hızlı ara veya komutlar..." : "Quick search or commands..."}
            </span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-800 text-[10px] font-mono font-bold text-gray-600 dark:text-slate-300 shadow-xs border border-gray-200 dark:border-slate-700">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-4">
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
              {theme === "light" ? <Moon size={18} strokeWidth={2.5} /> : <Sun size={18} strokeWidth={2.5} />}
            </button>

            {/* Notification bell */}
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pt-4 sm:pt-8 pb-28 sm:pb-28 lg:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (Instagram / TikTok / YouTube style) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-t border-gray-200/80 dark:border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-1.5 px-2 select-none">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* 1. Özet */}
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-90 ${
              pathname === "/dashboard"
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <LayoutDashboard size={21} strokeWidth={pathname === "/dashboard" ? 2.5 : 1.8} />
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {t("nav.overview")}
            </span>
          </Link>

          {/* 2. Takvim */}
          <Link
            href="/dashboard/takvim"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-90 ${
              pathname.startsWith("/dashboard/takvim")
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Calendar size={21} strokeWidth={pathname.startsWith("/dashboard/takvim") ? 2.5 : 1.8} />
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {t("nav.calendar")}
            </span>
          </Link>

          {/* 3. Müşteriler */}
          <Link
            href="/dashboard/musteriler"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-90 ${
              pathname.startsWith("/dashboard/musteriler")
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Users size={21} strokeWidth={pathname.startsWith("/dashboard/musteriler") ? 2.5 : 1.8} />
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {t("nav.customers")}
            </span>
          </Link>

          {/* 4. Hizmetler */}
          <Link
            href="/dashboard/hizmetler"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-90 ${
              pathname.startsWith("/dashboard/hizmetler")
                ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Wrench size={21} strokeWidth={pathname.startsWith("/dashboard/hizmetler") ? 2.5 : 1.8} />
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {t("nav.services")}
            </span>
          </Link>

          {/* 5. Menü (More Drawer) */}
          {(() => {
            const isMoreActive =
              pathname.startsWith("/dashboard/icerikler") ||
              pathname.startsWith("/dashboard/gecmis-randevular") ||
              pathname.startsWith("/dashboard/ayarlar");
            return (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-90 ${
                  isMoreActive || mobileMenuOpen
                    ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                    : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                }`}
              >
                <Menu size={21} strokeWidth={isMoreActive || mobileMenuOpen ? 2.5 : 1.8} />
                <span className="text-[10px] mt-1 tracking-tight leading-none">
                  {lang === "tr" ? "Menü" : "Menu"}
                </span>
              </button>
            );
          })()}
        </div>
      </nav>

      {/* Mobile Bottom Sheet Menu (Drawer) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
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
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm">
                  {userEmail ? userEmail.charAt(0).toUpperCase() : "B"}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
                    {userEmail || "İşletme Hesabı"}
                  </p>
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {t("nav.business_account")}
                  </p>
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
              {[
                { href: "/dashboard/icerikler", icon: ImageIcon, label: t("nav.posts") },
                { href: "/dashboard/gecmis-randevular", icon: History, label: t("nav.past_appointments") },
                { href: "/dashboard/ayarlar", icon: Settings, label: t("nav.settings") },
              ].map((item) => {
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
                      <item.icon size={20} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                        {lang === "tr" ? "Aktif" : "Active"}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Müşteri Sayfası Linki */}
              <Link
                href="/discover"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-all"
              >
                <Search size={20} className="text-gray-400" />
                <span>{lang === "tr" ? "Müşteri Keşfet Sayfası" : "Customer Discover"}</span>
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
                  <span>{theme === "light" ? (lang === "tr" ? "Koyu Mod" : "Dark Mode") : (lang === "tr" ? "Açık Mod" : "Light Mode")}</span>
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
                placeholder={lang === "tr" ? "Sayfa ara, işlem yap veya komut gir..." : "Search pages or run commands..."}
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
                  {navItems
                    .filter((item) =>
                      t(item.i18nKey).toLowerCase().includes(cmdQuery.toLowerCase())
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
                            <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                            <span>{t(item.i18nKey)}</span>
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
                      {theme === "light" ? <Moon size={16} className="text-amber-500" /> : <Sun size={16} className="text-amber-400" />}
                      <span>{lang === "tr" ? "Temayı Değiştir (Açık / Koyu)" : "Toggle Theme (Light / Dark)"}</span>
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
                      <span>{lang === "tr" ? "Dili Değiştir (TR / EN)" : "Toggle Language"}</span>
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
              <span>{lang === "tr" ? "Gitmek için tıklayın veya klavyeden seçin" : "Click or use keyboard to navigate"}</span>
              <span className="font-mono">⌘K</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}