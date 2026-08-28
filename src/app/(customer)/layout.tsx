"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Moon, Sun, Search, Calendar, User, Zap, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/context/LanguageContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";

const navItems = [
  { href: "/discover", icon: Search, label: "Keşfet" },
  { href: "/my-appointments", icon: Calendar, label: "Randevularım" },
  { href: "/profile", icon: User, label: "Profilim" },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t, lang, toggleLanguage } = useLanguage();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (prefersDark ? "dark" : "light");

    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    isFirstRender.current = false;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) return;
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="fixed inset-0 overflow-hidden p-4 md:p-6 flex gap-4 md:gap-6 bg-slate-50 dark:bg-[#0B0D14]">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-purple-900/20 dark:mix-blend-screen" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-indigo-900/20 dark:mix-blend-screen" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-pink-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob-slow dark:bg-pink-900/20 dark:mix-blend-screen" />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 backdrop-blur-md bg-black/20 lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-4 left-4 z-50 flex w-64 shrink-0 flex-col rounded-[28px] bg-white/60 backdrop-blur-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 ease-out lg:static lg:translate-x-0 lg:h-full dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ${sidebarOpen ? "translate-x-0" : "-translate-x-[120%]"}`}>
        <div className="flex h-20 items-center justify-between px-6 pt-2">
          <DynamicLogoLink className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 border border-gray-200/50 dark:border-slate-700/50">
              <img src="/logo-light.png" alt="Randera Logo" className="h-full w-full object-cover dark:hidden" />
              <img src="/logo-dark.png" alt="Randera Logo" className="hidden h-full w-full object-cover dark:block" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-slate-100">Randera</span>
          </DynamicLogoLink>
          <button onClick={() => setSidebarOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300 lg:hidden transition-colors"><X size={20} /></button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-95 ${isActive ? "bg-white/90 text-indigo-700 shadow-sm backdrop-blur-xl dark:bg-slate-800/90 dark:text-indigo-400 dark:shadow-black/20" : "text-gray-500 hover:bg-white/50 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"}`}>
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 pb-4">
          <div className="flex flex-col gap-2 rounded-2xl p-3 text-sm transition-colors bg-white/30 dark:bg-slate-800/30">
            <Link href="/upgrade" className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 px-4 py-2 text-[13px] font-bold text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10 mb-2">
              <Zap size={16} /> İşletme Hesabına Geç
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white shadow-sm">{userEmail ? userEmail.charAt(0).toUpperCase() : "U"}</div>
              <div className="flex-1 truncate">
                <p className="font-semibold tracking-tight text-gray-800 dark:text-slate-200 truncate">{userEmail || "Yükleniyor..."}</p>
                <p className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">Müşteri Hesabı</p>
              </div>
            </div>
            <button onClick={handleLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"><LogOut size={16} /> Çıkış Yap</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full min-h-0 gap-4 md:gap-6 overflow-hidden relative z-10">
        <header className="shrink-0 z-40 flex h-16 items-center justify-between rounded-[28px] border border-white/50 bg-white/60 backdrop-blur-3xl px-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all">
          <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 text-gray-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10 lg:hidden transition-colors active:scale-90"><Menu size={22} /></button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={toggleLanguage} className="rounded-full px-3 py-1 text-sm font-bold text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10">{lang === "tr" ? "TR" : "EN"}</button>
            <button onClick={toggleTheme} className="rounded-full p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10">{theme === "light" ? <Moon size={20} strokeWidth={2.5} /> : <Sun size={20} strokeWidth={2.5} />}</button>
            <NotificationBell />
          </div>
        </header>
        
        <main className="flex-1 min-h-0 rounded-[28px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/50 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-y-auto overflow-x-hidden custom-scrollbar p-6 md:p-8 pr-3 md:pr-4 relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
}
