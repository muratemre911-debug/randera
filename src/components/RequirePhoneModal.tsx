"use client";

import { useState } from "react";
import {
  Phone,
  ShieldAlert,
  Loader2,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";

interface RequirePhoneModalProps {
  isOpen: boolean;
  userId: string;
  onSuccess: (phone: string) => void;
}

export default function RequirePhoneModal({
  isOpen,
  userId,
  onSuccess,
}: RequirePhoneModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10 || clean.length > 13) {
      setError(
        lang === "tr"
          ? "Lütfen geçerli bir telefon numarası girin (Örn: 05XX XXX XX XX)."
          : "Please enter a valid phone number (e.g. 05XX XXX XX XX).",
      );
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ phone: clean })
        .eq("id", userId);

      if (updateError) throw updateError;

      onSuccess(clean);
    } catch (err) {
      setError(
        (err instanceof Error && err.message) ||
          (lang === "tr"
            ? "Telefon kaydedilirken bir hata oluştu."
            : "Failed to save phone number."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-2xl border border-white/60 dark:border-slate-800 text-center space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)] ring-8 ring-[var(--brand-soft)]">
          <Phone size={32} />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert size={13} />
            {lang === "tr" ? "Zorunlu Adım" : "Required Step"}
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {lang === "tr"
              ? "Telefon Numaranızı Ekleyin"
              : "Add Your Phone Number"}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            {lang === "tr"
              ? "Randevularınızın işletmeler tarafından onaylanması, değişiklikler ve hatırlatma mesajları için telefon numaranızı kaydetmeniz zorunludur."
              : "A verified phone number is required so businesses can confirm your appointments and send updates."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="text-left">
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
              {lang === "tr" ? "Telefon Numarası" : "Phone Number"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/80 px-4 py-3.5 text-base font-semibold text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
              />
            </div>
            {error && (
              <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-white font-bold text-sm shadow-lg shadow-[color:var(--brand-shadow)] transition-all active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>
              {lang === "tr"
                ? "Numaramı Kaydet ve Devam Et"
                : "Save and Continue"}
            </span>
          </button>
        </form>

        <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut size={13} />
            {lang === "tr"
              ? "Farklı bir hesapla giriş yap / Çıkış"
              : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
