"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Ortak modal kabı.
 *
 * Neden gerekli: uygulamada birbirinden kopuk en az 8 ayrı modal vardı ve
 * hiçbirinde şu üç şey eksik değildi:
 *
 *  1. **Odak hapsi (focus trap)** — ekran okuyucu/klavye kullanıcısı
 *     arka plandaki sayfayla etkileşebiliyordu.
 *  2. **ESC ile kapatma** — klavyeden çıkış yolu yoktu.
 *  3. **Yükseklik sınırı** — mobilde klavye açıkken içeriğin altı (butonlar,
 *     "çıkış yap" bağlantısı) ekran dışında kalıyor, kaydırılamıyordu.
 *
 * Bu bileşen üçünü birden çözer ve `ConfirmDialog`, `RequirePhoneModal`,
 * randevu iptal/geri çekme diyalogları ve panel modalları için kullanılır.
 *
 * Erişilebilirlik:
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
 *  - Açılışta odak diyaloğun içine alınır, kapanışta tetikleyen düğmeye döner
 *  - Tab tuşu diyaloğun içinde döngüde kalır
 *  - ESC kapatır (kapatılamayan modallar `dismissible={false}` ile korunur)
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Erişilebilir diyalog adı (başlık metni). */
  title: string;
  /** Başlık metnini göster. Varsayılan true. */
  showTitle?: boolean;
  children: ReactNode;
  /** Alt kısımda buton alanı (sticky kalsın). */
  footer?: ReactNode;
  /** ESC ve backdrop tıklamasıyla kapanabilsin mi? */
  dismissible?: boolean;
  /** Z-index (varsayılan 200). */
  zIndex?: number;
  /** Mobilde alttan yukarı açılan sheet gibi davransın. */
  sheetOnMobile?: boolean;
  /** Ekstra sınıf (panel genişliği vb.). */
  className?: string;
  /** Kapatma düğmesini gizle. */
  hideCloseButton?: boolean;
}

/** Diyaloğun içinde odaklanabilir öğeler. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Öğe gerçekten odaklanabilir mi?
 *
 * `offsetParent` kontrolü kullanılmaz: gizli (`display:none`) öğeler için
 * `null` döner, ama `position: fixed` öğelerde her zaman `null` olur — yani
 * gerçekte görünür olan butonlar da elenirdi. Bunun yerine hesaplanan
 * stil denetlenir (görünürlük + görünür kutu).
 */
function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute("inert")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  // `hidden` özniteliği veya 0 boyut → odaklanılamaz.
  if (el.hasAttribute("hidden")) return false;

  const rects = Array.from(el.getClientRects());
  if (rects.length > 0) {
    return rects.some((r) => r.width > 0 || r.height > 0);
  }

  // jsdom gibi yerleşimi olmayan ortamlarda ölçüm yapılamaz; bu durumda
  // gizlenmemiş öğeyi odaklanabilir say.
  return true;
}

export default function Modal({
  open,
  onClose,
  title,
  showTitle = true,
  children,
  footer,
  dismissible = true,
  zIndex = 200,
  sheetOnMobile = false,
  className = "",
  hideCloseButton = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // ESC + odak hapsi + arka plan kaydırma kilidi
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(isFocusable);

      if (focusables.length === 0) {
        // Odaklanacak öğe yoksa diyaloğun kendisine odaklan.
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // Arka planın kaymasını engelle (iOS'ta gövde kayması modal açılınca
    // sayfayı kaydırıyordu).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // İlk odağı diyaloğun içine al.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panel;
      target.focus({ preventScroll: true });
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(raf);
      // Odağı tetikleyen öğeye geri ver.
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const positionClasses = sheetOnMobile
    ? "items-end sm:items-center p-0 sm:p-4"
    : "items-center p-3 sm:p-4";

  const panelClasses = sheetOnMobile
    ? "w-full max-w-md rounded-t-[28px] sm:rounded-[28px] max-h-[92svh] sm:max-h-[88vh]"
    : "w-full max-w-md rounded-[28px] max-h-[90svh]";

  return createPortal(
    <div
      data-no-swipe
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-0 z-[${
        zIndex
      }] flex justify-center overflow-hidden ${positionClasses}`}
      style={{ zIndex }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-backdrop-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex flex-col overflow-hidden border border-white/60 bg-white shadow-2xl outline-none animate-modal-in dark:border-slate-700/60 dark:bg-slate-900 ${panelClasses} ${className}`}
      >
        {/* Başlık */}
        {(showTitle || !hideCloseButton) && (
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
            {showTitle ? (
              <h2
                id={titleId}
                className="text-[17px] font-bold leading-tight text-slate-900 dark:text-slate-100"
              >
                {title}
              </h2>
            ) : (
              <span id={titleId} className="sr-only">
                {title}
              </span>
            )}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Close"
                className="-mr-1.5 -mt-1 shrink-0 rounded-full p-2 text-slate-400 transition active:scale-90 disabled:opacity-40 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={17} />
              </button>
            )}
          </div>
        )}

        {/* İçerik: kaydırılabilir. Klavye açıkken alt kısım erişilebilir kalır. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 custom-scrollbar">
          {children}
        </div>

        {/* Alt kısım: sabit, içerik kaydırılırken de görünür kalır. */}
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
