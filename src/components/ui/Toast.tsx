"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/haptics";

/**
 * Native uygulama tarzı yüzen bildirim (snackbar).
 *
 * İçerik akışını iten satır içi banner'ların yerine geçer: çentik payının
 * hemen altında, cam görünümlü tek bir kapsül belirir; kendiliğinden kaybolur.
 * Başarı/hata anında hafif haptik geri bildirim verilir.
 */

export type ToastType = "success" | "error" | "info";

interface ToastState {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalıdır.");
  return ctx;
}

const VISIBLE_MS = 3200;
const EXIT_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const hideTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (removeTimer.current !== null) window.clearTimeout(removeTimer.current);
    hideTimer.current = null;
    removeTimer.current = null;
  };

  const dismiss = useCallback(() => {
    clearTimers();
    setCurrent((c) => (c ? { ...c, leaving: true } : null));
    removeTimer.current = window.setTimeout(() => setCurrent(null), EXIT_MS);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      clearTimers();
      setCurrent({ id: Date.now(), type, message, leaving: false });
      triggerHapticFeedback();
      hideTimer.current = window.setTimeout(() => {
        setCurrent((c) => (c ? { ...c, leaving: true } : null));
        removeTimer.current = window.setTimeout(
          () => setCurrent(null),
          EXIT_MS,
        );
      }, VISIBLE_MS);
    },
    [],
  );

  useEffect(() => clearTimers, []);

  const icon =
    current?.type === "success" ? (
      <CheckCircle2 size={18} className="shrink-0 text-emerald-400 dark:text-emerald-600" />
    ) : current?.type === "error" ? (
      <AlertCircle size={18} className="shrink-0 text-rose-400 dark:text-rose-600" />
    ) : (
      <Info size={18} className="shrink-0 text-sky-400 dark:text-sky-600" />
    );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {current &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 z-[400] flex justify-center px-4"
            style={{ top: "calc(var(--safe-top, 0px) + 12px)" }}
          >
            <div
              key={current.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full border border-white/10 bg-slate-900/90 py-2.5 pl-4 pr-2 text-[13px] font-semibold leading-snug text-white shadow-[0_12px_32px_rgb(2,6,23,0.28)] backdrop-blur-xl dark:border-black/5 dark:bg-white/95 dark:text-slate-900 dark:shadow-[0_12px_32px_rgb(0,0,0,0.45)] ${
                current.leaving ? "animate-toast-out" : "animate-toast-in"
              }`}
            >
              {icon}
              <span className="min-w-0">{current.message}</span>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Kapat"
                className="shrink-0 cursor-pointer rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white dark:text-slate-400 dark:hover:bg-black/5 dark:hover:text-slate-700"
              >
                <X size={14} />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
