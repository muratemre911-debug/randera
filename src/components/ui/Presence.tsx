"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Çıkış animasyonlu içerik değişimi (Apple tarzı "presence").
 *
 * React normalde eski çocuğu DOM'dan anında kaldırır; bu bileşen eski içeriği
 * `exitClassName` animasyonu bitene kadar tutar, böylece her içerik değişimi
 * (header bağlamı, sihirbaz adımı, sekme paneli, yükleme→içerik) yumuşak bir
 * geçişle yaşanır. Yeni içerik `enterClassName` ile girer.
 *
 * - `stacked`: iki katman aynı hücrede üst üste biner (header, ikon değişimi).
 *   Aksi halde çıkan katman mutlak konumlanır; kap `relative` olur.
 * - Hızlı ardışık değişimlerde yalnızca son çıkan katman tutulur.
 * - `prefers-reduced-motion` açıksa çıkış katmanı hiç oluşturulmaz.
 */

interface PresenceProps {
  /** Değiştiğinde geçiş tetiklenir. */
  swapKey: string | number;
  children: ReactNode;
  enterClassName?: string;
  exitClassName?: string;
  className?: string;
  stacked?: boolean;
}

interface Exiting {
  key: string | number;
  node: ReactNode;
}

export default function Presence({
  swapKey,
  children,
  enterClassName = "",
  exitClassName = "",
  className = "",
  stacked = false,
}: PresenceProps) {
  const [exiting, setExiting] = useState<Exiting | null>(null);
  const prev = useRef({ key: swapKey, node: children });

  useEffect(() => {
    if (prev.current.key === swapKey) {
      prev.current.node = children;
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      setExiting({ key: prev.current.key, node: prev.current.node });
    }
    prev.current = { key: swapKey, node: children };
    // children her render'da değişebilir; geçiş yalnızca anahtarla tetiklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapKey]);

  // Emniyet supabı: animationend gelmezse (ör. sekme arka planda) katmanı kaldır.
  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => setExiting(null), 600);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  const layerClass = stacked ? "[grid-area:1/1] min-w-0" : "";

  return (
    <div
      className={`${stacked ? "grid" : "relative"} ${className}`}
    >
      {exiting && (
        <div
          key={String(exiting.key) + "-out"}
          aria-hidden="true"
          className={`${layerClass} ${exitClassName}`}
          style={
            stacked
              ? { pointerEvents: "none" }
              : { pointerEvents: "none", position: "absolute", inset: 0 }
          }
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setExiting(null);
          }}
        >
          {exiting.node}
        </div>
      )}
      <div
        key={String(swapKey) + "-in"}
        className={`${layerClass} ${enterClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
