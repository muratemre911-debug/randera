"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Moon,
  Sun,
  Search,
  Calendar,
  User,
  LogOut,
  Heart,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";
import RequirePhoneModal from "@/components/RequirePhoneModal";
import { SHELL } from "@/components/layout/shell";
import UserAvatar, { getDisplayName } from "@/components/layout/UserAvatar";
import CustomerTabs, {
  type CustomerTab,
} from "@/components/customer/CustomerTabs";
import CustomerBottomNav, {
  type BottomNavItem,
} from "@/components/customer/CustomerBottomNav";
import { preventFocusScroll } from "@/lib/preventFocusScroll";

// Sekme sayfaları tembel yüklenir: sadece ekrandaki (ve mobilde yandaki) sekme indirilir
const DiscoverPage = dynamic(() => import("@/app/(customer)/discover/page"));
const FavoritesPage = dynamic(() => import("@/app/(customer)/favorites/page"));
const MyAppointmentsPage = dynamic(
  () => import("@/app/(customer)/my-appointments/page"),
);
const ProfilePage = dynamic(() => import("@/app/(customer)/profile/page"));

// Alt menü öğeleri hem sidebar/bottom nav ikonlarını hem de rayın sayfasını taşır
const customerNavItems: (CustomerTab & Omit<BottomNavItem, "href">)[] = [
  { href: "/discover", icon: Search, label: "Keşfet", Page: DiscoverPage },
  {
    href: "/favorites",
    icon: Heart,
    label: "Favorilerim",
    Page: FavoritesPage,
  },
  {
    href: "/my-appointments",
    icon: Calendar,
    label: "Randevularım",
    Page: MyAppointmentsPage,
  },
  { href: "/profile", icon: User, label: "Profilim", Page: ProfilePage },
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

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Business owners / staff can also use the customer area; return button is at bottom of sidebar
  const isBusinessAccount = userRole === "owner" || userRole === "staff";
  const navItems = customerNavItems;
  // Sekme sayfaları yatay rayda (kaydırmalı geçiş) gösterilir; diğer sayfalar (ör. /b/[slug]) normal render edilir
  const isTabRoute = customerNavItems.some((item) =>
    pathname.startsWith(item.href),
  );

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

        if (profile?.role === "customer" && !profile?.phone) {
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

  // Sayfa değiştiğinde içeriği en başa kaydır ve pencere kaymasını sıfırla
  useEffect(() => {
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
                  {isBusinessAccount
                    ? t("nav.business_account")
                    : t("nav.customer_account")}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <LogOut size={16} /> Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      <div ref={columnRef} className={SHELL.column}>
        <header className={SHELL.header}>
          {/* Mobile Brand Logo on left */}
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
              {lang === "tr" ? "TR" : "EN"}
            </button>
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
            <NotificationBell />
          </div>
        </header>

        {isTabRoute ? (
          <CustomerTabs tabs={customerNavItems} />
        ) : (
          <main
            ref={mainRef}
            className={SHELL.main}
            onMouseDown={preventFocusScroll}
          >
            {children}
          </main>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Instagram / TikTok / YouTube style) */}
      {!pathname.includes("/randevu") && <CustomerBottomNav tabs={navItems} />}

      {userId && (
        <RequirePhoneModal
          isOpen={showPhoneModal}
          userId={userId}
          onSuccess={() => setShowPhoneModal(false)}
        />
      )}
    </div>
  );
}
