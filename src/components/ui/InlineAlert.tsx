"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

/**
 * Satır içi durum mesajı (hata / başarı / bilgi).
 *
 * Neden gerekli: hata mesajları `alert()` ile gösteriliyordu. Tarayıcı
 * diyaloğu mobilde tüm akışı keser, tasarımla uyuşmaz ve kullanıcı mesajı
 * kaçırabilir. Bu bileşen mesajı sayfanın içinde, kalıcı ve erişilebilir
 * (`role="alert"`) biçimde gösterir.
 */
type AlertKind = "error" | "success" | "info";

const STYLES: Record<
  AlertKind,
  { wrap: string; icon: string; Icon: typeof AlertCircle }
> = {
  error: {
    wrap: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300",
    icon: "text-red-600 dark:text-red-400",
    Icon: AlertCircle,
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  info: {
    wrap: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300",
    icon: "text-indigo-600 dark:text-indigo-400",
    Icon: Info,
  },
};

interface InlineAlertProps {
  kind?: AlertKind;
  children: ReactNode;
  /** Verilirse sağda kapatma düğmesi gösterilir. */
  onDismiss?: () => void;
  className?: string;
}

export default function InlineAlert({
  kind = "error",
  children,
  onDismiss,
  className = "",
}: InlineAlertProps) {
  if (!children) return null;
  const { wrap, icon, Icon } = STYLES[kind];

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-[13px] font-semibold leading-snug ${wrap} ${className}`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${icon}`} />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Kapat"
          className="shrink-0 rounded-full px-1 opacity-70 transition active:scale-90"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
