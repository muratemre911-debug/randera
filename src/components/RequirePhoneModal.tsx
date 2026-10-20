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
import Modal from "@/components/ui/Modal";
import {
  inspectTrMobile,
  trMobileErrorMessage,
  TR_MOBILE_PLACEHOLDER,
} from "@/lib/phone";

interface RequirePhoneModalProps {
  isOpen: boolean;
  onSuccess: (phone: string) => void;
}

export default function RequirePhoneModal({
  isOpen,
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

    // Biçim + uydurma desen kontrolü (sunucu da aynı kontrolü yeniden yapar)
    const check = inspectTrMobile(phone);
    if (!check.ok) {
      setError(trMobileErrorMessage(check.issue, lang));
      return;
    }

    setLoading(true);
    try {
      // Kaydetme sunucu üzerinden yapılır: "bir numara yalnızca bir hesapta"
      // kuralı başka profilleri okumayı gerektirir, istemciden kontrol edilemez.
      const res = await fetch("/api/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: check.phone }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            (lang === "tr"
              ? "Telefon kaydedilirken bir hata oluştu."
              : "Failed to save phone number."),
        );
      }

      onSuccess(data?.phone || check.phone);
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
    <Modal
      open={isOpen}
      onClose={() => {}}
      title={
        lang === "tr" ? "Telefon Numaranızı Ekleyin" : "Add Your Phone Number"
      }
      showTitle={false}
      dismissible={false}
      hideCloseButton
      zIndex={9999}
    >
      <div className="space-y-5 text-center">
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
              ? "Randevularınızın işletme tarafından onaylanması ve size ulaşabilmesi için telefon numaranızı kaydetmeniz zorunludur. Aynı numara yalnızca bir hesapta kullanılabilir."
              : "A phone number is required so businesses can confirm your appointments and reach you. A number can only be used by one account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="text-left">
            <label
              htmlFor="require-phone-input"
              className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
            >
              {lang === "tr" ? "Telefon Numarası" : "Phone Number"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="require-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                data-autofocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={TR_MOBILE_PLACEHOLDER}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/80 px-4 py-3.5 text-base font-semibold text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20 transition-all"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400"
              >
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
    </Modal>
  );
}
