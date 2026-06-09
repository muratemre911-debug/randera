"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Calendar,
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
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const navItems = [
  { label: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard },
  { label: "Takvim", href: "/dashboard/takvim", icon: Calendar },
  { label: "Hizmetler", href: "/dashboard/hizmetler", icon: Wrench },
  { label: "Müşteriler", href: "/dashboard/musteriler", icon: Users },
  { label: "Ayarlar", href: "/dashboard/ayarlar", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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
    <div className="flex h-screen relative overflow-hidden bg-gray-50/50 dark:bg-slate-950">
      {/* Animated Mesh Gradient Backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-purple-900/20 dark:mix-blend-screen" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:bg-indigo-900/20 dark:mix-blend-screen" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-pink-400/20 mix-blend-multiply filter blur-3xl opacity-70 animate-blob-slow dark:bg-pink-900/20 dark:mix-blend-screen" />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-md bg-black/20 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <aside
        className={`fixed inset-y-4 left-4 z-50 flex w-64 flex-col rounded-3xl bg-white/60 backdrop-blur-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 ease-out lg:static lg:translate-x-0 dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between px-6 pt-2">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 border border-gray-200/50 dark:border-slate-700/50">
              <img src="/logo-light.png" alt="Randeo Logo" className="h-full w-full object-cover dark:hidden" />
              <img src="/logo-dark.png" alt="Randeo Logo" className="hidden h-full w-full object-cover dark:block" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-slate-100">
              Randeo
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300 lg:hidden transition-colors"
          >
            <X size={20} />
          </button>
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
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-95 ${
                  isActive
                    ? "bg-white/90 text-indigo-700 shadow-sm backdrop-blur-xl dark:bg-slate-800/90 dark:text-indigo-400 dark:shadow-black/20"
                    : "text-gray-500 hover:bg-white/50 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                }`}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
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
                  {userEmail || "Yükleniyor..."}
                </p>
                <p className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">İşletme Hesabı</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <LogOut size={16} />
              Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        {/* Floating Header */}
        <header className="sticky top-4 z-40 mx-4 lg:mx-8 flex h-16 items-center justify-between rounded-3xl border border-white/50 bg-white/60 backdrop-blur-3xl px-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-full p-2 text-gray-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10 lg:hidden transition-colors active:scale-90"
          >
            <Menu size={22} />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-full p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {theme === "light" ? <Moon size={20} strokeWidth={2.5} /> : <Sun size={20} strokeWidth={2.5} />}
            </button>

            {/* Notification bell */}
            <button className="relative rounded-full p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10">
              <Bell size={20} strokeWidth={2.5} />
              <span className="absolute right-2.5 top-2.5 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pt-8 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
