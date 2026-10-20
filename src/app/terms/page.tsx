"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Globe, CheckCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function TermsPage() {
  const { lang, toggleLanguage } = useLanguage();
  const isTr = lang === "tr";

  return (
    <div className="page-fill bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex min-h-6 items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft size={18} />
            <span>{isTr ? "Ana Sayfaya Dön" : "Back to Home"}</span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Globe size={14} />
              <span>{lang.toUpperCase()}</span>
            </button>

            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                <img
                  src="/logo/logo-light-160.png"
                  alt="Randera"
                  width={160}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="font-bold text-base text-slate-900 dark:text-white">Randera</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-indigo-50/50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 py-12 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-4">
            <FileText size={14} />
            <span>{isTr ? "Kullanım Şartları" : "Terms & Conditions"}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isTr ? "Kullanım Koşulları" : "Terms of Service"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isTr ? "Son Güncelleme: 14 Eylül 2026" : "Last Updated: September 14, 2026"}
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/70 dark:border-slate-800 p-6 sm:p-10 shadow-sm space-y-8">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isTr ? "1. Kabul Edilen Şartlar" : "1. Acceptance of Terms"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
              {isTr
                ? "Randera platformunu ziyaret ederek veya Google / e-posta ile hesap oluşturarak bu Kullanım Koşulları'nı kabul etmiş sayılırsınız."
                : "By accessing Randera or registering an account via Google or email, you agree to comply with and be bound by these Terms of Service."}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isTr ? "2. Hizmet Tanımı" : "2. Description of Service"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
              {isTr
                ? "Randera, işletmelerin randevu takvimlerini, personel ve hizmetlerini organize etmesini sağlayan; müşterilerin ise online olarak randevu oluşturmasına imkan tanıyan bir randevu ve işletme yönetim platformudur."
                : "Randera provides an online appointment scheduling and business management system that connects service providers with their clients."}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isTr ? "3. Hesap Sorumlulukları" : "3. User Responsibilities"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
              {isTr
                ? "Kullanıcılar hesap bilgilerinin gizliliğini korumakla yükümlüdür. Google ile yapılan oturumlarda Google hesap güvenliğinin sağlanması kullanıcının sorumluluğundadır."
                : "Users are responsible for safeguarding their account credentials and maintaining accurate booking details."}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isTr ? "4. İletişim" : "4. Contact"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
              {isTr
                ? "Koşullarla ilgili her türlü soru için destek@randera.com üzerinden bize ulaşabilirsiniz."
                : "For any inquiries regarding these terms, please contact us at destek@randera.com."}
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Randera. {isTr ? "Tüm hakları saklıdır." : "All rights reserved."}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="flex min-h-6 items-center hover:underline">
              {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
            </Link>
            <Link href="/terms" className="flex min-h-6 items-center text-indigo-600 dark:text-indigo-400 hover:underline">
              {isTr ? "Kullanım Koşulları" : "Terms of Service"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
