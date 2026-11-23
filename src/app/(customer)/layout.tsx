"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Moon,
  Sun,
  Search,
  Calendar,
  User,
  LogOut,
  Heart,
  LayoutDashboard,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";
import RequirePhoneModal from "@/components/RequirePhoneModal";
import { SHELL } from "@/components/layout/shell";
import BrandLogo from "@/components/layout/BrandLogo";
import UserAvatar, { getDisplayName } from "@/components/layout/UserAvatar";
import CustomerBottomNav, {
  type BottomNavItem,
} from "@/components/customer/CustomerBottomNav";
import SwipePager from "@/components/layout/SwipePager";
import Presence from "@/components/ui/Presence";
import { triggerHapticFeedback } from "@/lib/haptics";
import DiscoverPage from "./discover/page";
import FavoritesPage from "./favorites/page";
import MyAppointmentsPage from "./my-appointments/page";
import ProfilePage from "./profile/page";
import { preventFocusScroll } from "@/lib/preventFocusScroll";
import { isTrMobile } from "@/lib/phone";

/**
 * Müşteri navigasyonu.
 *
 * Etiketler `useMemo` içinde `t()` ile üretilir: dizi modül seviyesinde
 * tanımlı olsaydı etiketler Türkçe kalırdı ve dil değiştirildiğinde alt
 * menü/sidebar güncellenmezdi.
 */
function buildNavItems(t: (key: string) => string): BottomNavItem[] {
  return [
    { href: "/discover", icon: Search, label: t("nav.discover") },
    { href: "/favorites", icon: Heart, label: t("nav.favorites") },
    { href: "/my-appointments", icon: Calendar, label: t("nav.my_appointments") },
    { href: "/profile", icon: User, label: t("nav.profile") },
  ];
}

const CUSTOMER_TAB_PAGES = [
  { href: "/discover", Page: DiscoverPage },
  { href: "/favorites", Page: FavoritesPage },
  { href: "/my-appointments", Page: MyAppointmentsPage },
  { href: "/profile", Page: ProfilePage },
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t, lang, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Detay ekranları (işletme profili + randevu akışı): native uygulamalardaki
  // gibi "push" edilen sayfalardır — alt sekme çubuğu gizlenir, header'da
  // geri düğmesi ve ekran başlığı görünür.
  const isDetailRoute = pathname.startsWith("/b/");
  const detailTitle = pathname.includes("/randevu")
    ? t("nav.book_appointment")
    : t("nav.business_profile");

  const handleBack = () => {
    triggerHapticFeedback();
    const state = window.history.state as { idx?: number } | null;
    if (state && typeof state.idx === "number" && state.idx > 0) {
      router.back();
    } else {
      router.push("/discover");
    }
  };

  // Tema değişimi: destekleyen tarayıcılarda tüm ekran yumuşak bir
  // çapraz geçişle (View Transition) renk değiştirir — iOS hissi.
  const handleThemeToggle = () => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => toggleTheme());
    } else {
      toggleTheme();
    }
  };

  // Dil değişince etiketler de değişsin.
  const navItems = useMemo(() => buildNavItems(t), [t]);
  const customerPageTabs = useMemo(
    () =>
      CUSTOMER_TAB_PAGES.map(({ href, Page }) => ({
        href,
        content: <Page />,
      })),
    [],
  );

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Business owners / staff can also use the customer area; return button is at bottom of sidebar
  const isBusinessAccount = userRole === "owner" || userRole === "staff";

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, role, avatar_url")
          .eq("id", user.id)
          .single();

        setUserFullName(profile?.full_name ?? null);
        setUserAvatarUrl(profile?.avatar_url ?? null);
        setUserRole(profile?.role ?? null);

        // Numara eksikse ya da geçersizse (örn. eski kayıtlardaki uydurma
        // numaralar) müşteriden yeniden istenir.
        if (profile?.role === "customer" && !isTrMobile(profile?.phone)) {
          setShowPhoneModal(true);
        }
      }
    };
    getUser();
  }, []);

  // Profil sayfasında isim/fotoğraf güncellenince sidebar anında güncellensin
  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const detail = (
        event as CustomEvent<{ full_name?: string; avatar_url?: string }>
      ).detail;
      if (!detail) return;
      if (detail.full_name !== undefined) setUserFullName(detail.full_name);
      if (detail.avatar_url !== undefined) setUserAvatarUrl(detail.avatar_url);
    };
    window.addEventListener("randera:profile-updated", handleProfileUpdate);
    return () =>
      window.removeEventListener(
        "randera:profile-updated",
        handleProfileUpdate,
      );
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div ref={rootRef} className={SHELL.root}>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-purple-900/20 dark:mix-blend-screen" />
      <div
        className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-indigo-900/20 dark:mix-blend-screen"
        style={{ animationDelay: "2s" }}
      />
      <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-pink-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob-slow dark:bg-pink-900/20 dark:mix-blend-screen" />

      {/* Desktop Floating Sidebar */}
      <aside className={SHELL.sidebar}>
        <div className="flex h-20 items-center justify-between px-6 pt-2">
          <DynamicLogoLink className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 border border-gray-200/50 dark:border-slate-700/50">
              <BrandLogo className="h-full w-full object-cover" alt="" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-slate-100">
              Randera
            </span>
          </DynamicLogoLink>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-95 ${isActive ? "bg-white/90 text-indigo-700 shadow-sm backdrop-blur-xl dark:bg-slate-800/90 dark:text-indigo-400 dark:shadow-black/20" : "text-gray-500 hover:bg-white/50 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"}`}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 pb-4">
          <div className="flex flex-col gap-2 rounded-2xl p-3 text-sm transition-colors bg-white/30 dark:bg-slate-800/30">
            {isBusinessAccount && (
              <Link
                href="/dashboard"
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-colors mb-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200 hover:from-indigo-600 hover:to-purple-700 dark:shadow-indigo-950/40"
              >
                <LayoutDashboard size={16} />
                {t("nav.return_to_business")}
              </Link>
            )}
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
                <p className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">
                  {userRole === "owner"
                    ? t("nav.business_account")
                    : userRole === "staff"
                      ? t("nav.staff_account")
                      : t("nav.customer_account")}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <LogOut size={16} /> {t("nav.logout")}
            </button>
          </div>
        </div>
      </aside>

      <div ref={columnRef} className={SHELL.column}>
        <header className={SHELL.header}>
          {/* Mobil: detay ekranlarında geri + başlık, sekmelerde marka.
              Bağlam değişimi çapraz geçişle yumuşatılır (Presence). */}
          <Presence
            stacked
            swapKey={isDetailRoute ? detailTitle : "brand"}
            enterClassName="animate-swap-in"
            exitClassName="animate-swap-out"
            className="min-w-0 lg:hidden"
          >
            {isDetailRoute ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label={t("nav.back")}
                  className="-ml-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-700 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <ChevronLeft size={22} strokeWidth={2.4} />
                </button>
                <span className="truncate text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {detailTitle}
                </span>
              </div>
            ) : (
              <DynamicLogoLink className="flex items-center gap-2">
                <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-xs border border-gray-200/50 dark:border-slate-700/50">
                  <BrandLogo className="h-full w-full object-cover" alt="" />
                </div>
                <span className="hidden sm:inline text-base font-black tracking-tight text-gray-800 dark:text-slate-100">
                  Randera
                </span>
              </DynamicLogoLink>
            )}
          </Presence>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-1.5 sm:gap-4">
            {isBusinessAccount && (
              <Link
                href="/dashboard"
                title={t("nav.return_to_business")}
                className="lg:hidden rounded-full p-2 sm:p-2.5 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400 transition-all hover:bg-indigo-100 active:scale-90"
              >
                <LayoutDashboard size={18} strokeWidth={2.5} />
              </Link>
            )}
            <button
              onClick={toggleLanguage}
              className="rounded-full px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <Presence
                stacked
                swapKey={lang}
                enterClassName="animate-swap-in"
                exitClassName="animate-swap-out"
              >
                <span className="block">{lang === "tr" ? "TR" : "EN"}</span>
              </Presence>
            </button>
            <button
              onClick={handleThemeToggle}
              aria-label={
                theme === "light"
                  ? t("nav.dark_mode")
                  : t("nav.light_mode")
              }
              className="rounded-full p-2 sm:p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <Presence
                stacked
                swapKey={theme}
                enterClassName="animate-icon-spin-in"
                exitClassName="animate-swap-out"
              >
                {theme === "light" ? (
                  <Moon size={18} strokeWidth={2.5} className="block" />
                ) : (
                  <Sun size={18} strokeWidth={2.5} className="block" />
                )}
              </Presence>
            </button>
            <NotificationBell />
          </div>
        </header>

        <SwipePager
          ref={mainRef}
          tabs={customerPageTabs}
          className={SHELL.main}
          onMouseDown={preventFocusScroll}
        >
          {/* Detay sayfaları her gezinmede "push" animasyonuyla girer. */}
          <div
            key={isDetailRoute ? pathname : "tabs"}
            className={isDetailRoute ? "animate-push-in" : undefined}
          >
            {children}
          </div>
        </SwipePager>
      </div>

      {/* Mobil alt sekme çubuğu: ana sekmelerde görünür, detaylarda yumuşak
          bir kaymayla çekilir (Presence çıkış animasyonu). */}
      <Presence
        swapKey={isDetailRoute ? "hidden" : "tabs"}
        enterClassName="animate-bar-in"
        exitClassName="animate-bar-out"
      >
        {!isDetailRoute && <CustomerBottomNav tabs={navItems} />}
      </Presence>

      {userId && (
        <RequirePhoneModal
          isOpen={showPhoneModal}
          onSuccess={() => setShowPhoneModal(false)}
        />
      )}
    </div>
  );
}
