"use client";

import { useLanguage } from "@/context/LanguageContext";

/**
 * Randevu durum rozeti.
 *
 * Neden ayrı bileşen: durum rozeti üç ayrı ekranda (genel bakış, müşteriler,
 * geçmiş randevular) kopyalanmıştı ve geçmiş randevular ekranında her satır
 * sabit olarak "Tamamlandı" gösteriyordu — iptal edilmiş ya da onay bekleyen
 * bir randevu bile yeşil "Tamamlandı" rozetiyle listeleniyordu. Artık tek
 * yerden, gerçek `status` değerine göre üretiliyor.
 */

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | string;

/** Duruma göre renk sınıfları ve etiketler. */
const STATUS_STYLES: Record<
  string,
  { labelTr: string; labelEn: string; className: string }
> = {
  completed: {
    labelTr: "Tamamlandı",
    labelEn: "Completed",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
  },
  pending: {
    labelTr: "Onay Bekliyor",
    labelEn: "Pending Approval",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
  },
  confirmed: {
    labelTr: "Onaylandı",
    labelEn: "Confirmed",
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50",
  },
  cancelled: {
    labelTr: "İptal",
    labelEn: "Cancelled",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",
  },
};

/** Geçmiş bir randevu hâlâ "onaylı" ise gerçekleşmedi anlamına gelir. */
const PAST_STYLE = {
  labelTr: "Gerçekleşmedi",
  labelEn: "Not Completed",
  className:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

interface StatusBadgeProps {
  status: AppointmentStatus;
  /**
   * Randevunun zamanı geçmiş mi?
   *
   * Geçmiş randevu için "Onaylandı" yanıltıcıdır: müşteri geldi mi gelmedi
   * mi belli değildir. Bu durumda işletme sahibinin takvimi doğru okuması için
   * "Gerçekleşmedi" / "Onaylanmadı" ayrımı yapılır.
   */
  isPast?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  isPast = false,
  className = "",
}: StatusBadgeProps) {
  const { lang } = useLanguage();

  // Bilinmeyen bir durumda nötr görünüm (yanlış bilgi göstermemek için).
  const style = STATUS_STYLES[status] ?? {
    labelTr: "Beklemede",
    labelEn: "Unknown",
    className:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };

  // Geçmiş randevuda "onaylı" olmak, gerçekleşti anlamına gelmez.
  if (isPast && status === "confirmed") {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${PAST_STYLE.className} ${className}`}
      >
        {lang === "tr" ? PAST_STYLE.labelTr : PAST_STYLE.labelEn}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style.className} ${className}`}
    >
      {lang === "tr" ? style.labelTr : style.labelEn}
    </span>
  );
}
