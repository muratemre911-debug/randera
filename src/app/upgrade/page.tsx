"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import DynamicLogoLink from "@/components/DynamicLogoLink";
import { Loader2, Zap, CheckCircle2, Building2 } from "lucide-react";
import Link from "next/link";

const BENEFITS = [
  "Sınırsız randevu yönetimi",
  "Özel randevu sayfanız (randera.app/işletmeniz)",
  "Hizmet ve personel yönetimi",
  "Takvim & müsaitlik kontrolü",
  "Müşteri bildirimleri",
];

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [tenantName, setTenantName] = useState("");
  const [sector, setSector] = useState("");
  const [sectorsList, setSectorsList] = useState<{name: string, value: string}[]>([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  useEffect(() => {
    const fetchSectors = async () => {
      const res = await fetch('/api/admin/sectors');
      const data = await res.json();
      if (Array.isArray(data)) setSectorsList(data);
    };
    fetchSectors();

    const checkProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile(profile);
      setProfileLoading(false);

      // If user is already an owner/admin, redirect to dashboard
      if (profile && profile.role !== "customer") {
        router.push("/dashboard");
      }
    };

    checkProfile();
  }, []);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgradeLoading(true);
    setUpgradeError("");

    try {
      const res = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantName, sector }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bilinmeyen bir hata oluştu.");

      router.push("/dashboard");
    } catch (err: any) {
      setUpgradeError(err.message);
      setUpgradeLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  // Already an owner — show informational state instead of the form
  if (userProfile && userProfile.role !== "customer") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center">
            <DynamicLogoLink>
              <img src="/logo-light.png" alt="Randera Logo" className="h-6 w-auto dark:hidden" />
              <img src="/logo-dark.png" alt="Randera Logo" className="h-6 w-auto hidden dark:block" />
            </DynamicLogoLink>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-indigo-500 mb-4" />
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
              Zaten İşletme Hesabınız Var!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Randera Pro&apos;ya zaten geçmiş durumdasınız. Dashboard&apos;unuzdan işletmenizi yönetebilirsiniz.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-all"
            >
              <Building2 size={18} />
              Dashboard&apos;a Git
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center">
          <DynamicLogoLink>
            <img src="/logo-light.png" alt="Randera Logo" className="h-6 w-auto dark:hidden" />
            <img src="/logo-dark.png" alt="Randera Logo" className="h-6 w-auto hidden dark:block" />
          </DynamicLogoLink>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: Hero / Benefits */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              <Zap size={14} />
              Randera Pro
            </div>

            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
              İşletmenizi<br />
              <span className="text-indigo-600 dark:text-indigo-400">Randera Pro&apos;ya</span> Taşıyın
            </h1>

            <div className="inline-flex items-baseline gap-1">
              <span className="text-5xl font-extrabold text-gray-900 dark:text-white">599</span>
              <span className="text-2xl font-bold text-gray-500 dark:text-gray-400">TL</span>
              <span className="text-gray-400 dark:text-gray-500 ml-1">/ Ay</span>
            </div>

            <ul className="space-y-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                  <CheckCircle2 size={18} className="text-indigo-500 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Form card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-indigo-900/5 dark:shadow-none p-8 border border-gray-100 dark:border-slate-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              İşletmenizi Oluşturun
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Birkaç adımda işletme hesabınıza geçin ve hemen randevu almaya başlayın.
            </p>

            <form onSubmit={handleUpgrade} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  İşletme Adı
                </label>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Örn: Ahmet Kuaför"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sektör
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                >
                                    <option value="" disabled>Sektör Seçin</option>
                  {sectorsList.length > 0 ? (
                    sectorsList.map((s) => (
                      <option key={s.value} value={s.value}>{s.name}</option>
                    ))
                  ) : (
                    <option value="other">Diğer</option>
                  )}
                </select>
              </div>

              {upgradeError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
                  {upgradeError}
                </div>
              )}

              <button
                type="submit"
                disabled={upgradeLoading}
                className="w-full mt-2 bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {upgradeLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Zap size={18} />
                )}
                599 TL / Ay ile Başla
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-600">
              Devam ederek{" "}
              <Link href="/terms" className="underline hover:text-indigo-500 transition-colors">
                Kullanım Koşullarını
              </Link>{" "}
              kabul etmiş olursunuz.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
