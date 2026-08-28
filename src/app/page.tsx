"use client";

import Link from "next/link";
import Image from "next/image";
import { Users, Building2, ChevronRight, Moon, Sun, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { lang, toggleLanguage } = useLanguage();

  useEffect(() => {
    // Sadece client tarafında çalışması için useEffect
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
      <header className="w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <DynamicLogoLink className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Randera Logo" width={140} height={40} className="object-contain h-8 w-auto dark:hidden" />
            <Image src="/logo-dark.png" alt="Randera Logo" width={140} height={40} className="object-contain h-8 w-auto hidden dark:block" />
          </DynamicLogoLink>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800"
            >
              <Globe size={18} />
              {lang.toUpperCase()}
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-xl bg-gray-50 dark:bg-slate-800"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
            <Link 
              href="/login"
              className="hidden sm:block text-gray-600 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {lang === "tr" ? "Giriş Yap" : "Login"}
            </Link>
            <Link 
              href="/login"
              className="bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-full shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 hover:-translate-y-0.5 transition-all text-sm sm:text-base"
            >
              {lang === "tr" ? "Hemen Başla" : "Get Started"}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="relative overflow-hidden pt-20 pb-32">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-8 max-w-4xl mx-auto leading-tight">
              {lang === "tr" ? "İşletmeniz İçin" : "Smart Booking System for"}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                {lang === "tr" ? "Akıllı" : "Your Business"}
              </span>
              {lang === "tr" ? " Randevu Sistemi" : ""}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {lang === "tr" 
                ? "Randera ile ister berber, ister doktor, ister danışman olun; müşterilerinize profesyonel bir randevu alma deneyimi sunun."
                : "Whether you're a barber, doctor, or consultant, provide your customers with a professional booking experience."}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/login"
                className="w-full sm:w-auto bg-indigo-600 text-white text-lg font-bold py-4 px-8 rounded-full shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                {lang === "tr" ? "Ücretsiz Deneyin" : "Try for Free"} <ChevronRight size={20} />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 py-24 border-t border-gray-100 dark:border-slate-800">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                {lang === "tr" ? "Kimler İçin Uygun?" : "Who is it for?"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {lang === "tr" ? "Müşterileri ile zamana dayalı hizmet veren tüm sektörler" : "All sectors providing time-based services"}
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group">
                <div className="h-14 w-14 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm mb-6 group-hover:scale-110 transition-transform">
                  <Building2 size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {lang === "tr" ? "İşletmeler" : "Businesses"}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === "tr" ? "Kendi randevu takviminizi yönetin, hizmetlerinizi listeleyin ve çalışma saatlerinizi belirleyin." : "Manage your appointment calendar, list your services, and set your working hours."}
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group">
                <div className="h-14 w-14 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm mb-6 group-hover:scale-110 transition-transform">
                  <Users size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {lang === "tr" ? "Müşteriler" : "Customers"}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === "tr" ? "İstediğiniz işletmeden saniyeler içinde randevu alın. Yaklaşan ve geçmiş randevularınızı takip edin." : "Book appointments in seconds. Track your upcoming and past bookings."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 dark:bg-black text-slate-400 py-12 text-center border-t border-slate-800">
        <p>© 2026 Randera. {lang === "tr" ? "Tüm hakları saklıdır." : "All rights reserved."}</p>
      </footer>
    </div>
  );
}
