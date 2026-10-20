"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Portal ile açılan açılır menü.
 *
 * Neden gerekli: menü, sayfanın kaydırma kabının (`overflow-y-auto`) İÇİNDE
 * konumlandırılınca `bottom-full` ile yukarı açıldığında kabın sınırı
 * tarafından KIRPILIYOR ve butona erişilemiyordu. Aynı şekilde mutlak
 * konumlandırma, kabın kaydırılmasıyla birlikte menüyü yerinde bırakıyordu.
 *
 * Bu bileşen menüyü `document.body`'ye taşır ve `position: fixed` ile dünya
 * koordinatlarında konumlandırır; böylece ne kaydırma kabı ne de üstteki
 * başlık onu kesemez. Pencere yeniden boyutlandığında/kaydırıldığında konum
 * güncellenir.
 */

export interface DropdownMenuProps {
  /** Menüyü açan düğme. */
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Menü içeriği. */
  children: ReactNode;
  /** Düğmenin altına mı üstüne mi açılsın? "auto" yer durumuna göre seçer. */
  placement?: "bottom" | "top" | "auto";
  /** Menü genişliği (px). */
  width?: number;
  className?: string;
}

export default function DropdownMenu({
  trigger,
  open,
  onOpenChange,
  children,
  placement = "auto",
  width = 192,
  className = "",
}: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  // Menü konumunu dünya koordinatlarında hesapla.
  useLayoutEffect(() => {
    // Menü kapalıyken portal hiç render edilmediği için konum da
    // sıfırlanmaya gerek yok (setState'e gerek kalmaz).
    if (!open) return;

    const update = () => {
      const triggerEl = triggerRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const menuHeight = menuRef.current?.offsetHeight ?? 120;

      // Yukarıda daha çok yer varsa yukarı aç.
      const openUp =
        placement === "top" ||
        (placement === "auto" && spaceBelow < menuHeight && spaceAbove > spaceBelow);

      const top = openUp ? rect.top - menuHeight - 6 : rect.bottom + 6;

      // Yatayda ekrandan taşmayı engelle.
      const maxLeft = window.innerWidth - width - 8;
      const left = Math.max(8, Math.min(rect.left, maxLeft));

      setCoords({ top: Math.max(8, top), left });
    };

    update();

    // Kaydırma/yerleşim değişince konumu tazele.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, placement, width]);

  // Dışarı tıklama ve ESC ile kapatma.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
        className={className}
      >
        {trigger}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              width,
              visibility: coords ? "visible" : "hidden",
            }}
            className="fixed z-[300] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-slate-800 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
