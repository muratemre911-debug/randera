"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Uygulama içi onay diyaloğu.
 *
 * Neden gerekli: silme gibi geri alınamaz işlemler `window.confirm()` ile
 * soruluyordu. Mobilde tarayıcı diyaloğu tüm akışı kesiyor, tasarım diliyle
 * uyuşmuyor ve PWA'da "beyaz kutu" olarak görünüyor. Bu bileşen aynı işi
 * uygulamanın kendi tasarımıyla, klavye (Esc) desteğiyle ve yükleme durumuyla
 * yapar. Ayrıca `data-no-swipe` ile sekme kaydırma jestini engeller.
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Yıkıcı işlem (silme) ise kırmızı vurgu kullanılır. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      data-no-swipe
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-4"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-backdrop-in"
        onClick={() => !loading && onCancel()}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white p-5 shadow-2xl animate-modal-in dark:border-slate-700/60 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              destructive
                ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
            }`}
          >
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {message && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label={cancelLabel}
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-slate-400 transition active:scale-90 disabled:opacity-40 dark:text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-2.5 text-[13px] font-bold text-slate-700 transition active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-2xl py-2.5 text-[13px] font-bold text-white shadow-md transition active:scale-95 disabled:opacity-60 ${
              destructive
                ? "bg-red-600 shadow-red-500/25 hover:bg-red-500"
                : "bg-indigo-600 shadow-indigo-500/25 hover:bg-indigo-500"
            }`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
