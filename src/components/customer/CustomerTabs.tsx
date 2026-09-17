"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { SHELL } from "@/components/layout/shell";
import { emitTabScroll, settledTabIndex } from "@/lib/tabSwipe";
import { preventFocusScroll } from "@/lib/preventFocusScroll";

export interface CustomerTab {
  href: string;
  /** Sekmenin sayfası (route dosyasının default export'u) */
  Page: React.ComponentType;
}

/** Kaydırma durduktan sonra URL'i güncellemek için beklenecek süre (ms) */
const SETTLE_DELAY = 140;

/** Sekme rayı sadece mobilde parmakla kaydırılır (masaüstünde sidebar kullanılır) */
const isMobileViewport = () =>
  typeof window === "undefined" ||
  window.matchMedia("(max-width: 1023px)").matches;

/** Ray konumu boyamadan önce ayarlansın diye (SSR'de effect'e düşer) */
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Müşteri sekmelerini (Keşfet / Favorilerim / Randevularım / Profilim) tek bir
 * yatay rayda tutar. Parmakla sağa/sola kaydırınca iki sayfa aynı anda
 * görünür (yarısı soldaki, yarısı sağdaki) ve kaydırma bitince URL güncellenir.
 */
export default function CustomerTabs({ tabs }: { tabs: CustomerTab[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const index = Math.max(
    0,
    tabs.findIndex((tab) => pathname.startsWith(tab.href)),
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(index);

  // Görünen sekme her zaman yüklü kalır; yanındaki sekmeler mobilde önden yüklenir
  const [mounted, setMounted] = useState(() => tabs.map((_, i) => i === index));

  const ensureMounted = useCallback((...targets: number[]) => {
    setMounted((prev) => {
      const next = [...prev];
      let changed = false;
      for (const target of targets) {
        if (target >= 0 && target < next.length && !next[target]) {
          next[target] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    // Masaüstünde sidebar'dan tek sekme gezilir; önden yüklemeye gerek yok
    if (!isMobileViewport()) return;
    // Komşu sekmeyi önden yükle: parmakla kaydırınca içerik boş görünmesin
    const timer = setTimeout(() => ensureMounted(index - 1, index + 1), 0);
    return () => clearTimeout(timer);
  }, [index, ensureMounted]);

  // URL değişince rayı ilgili sekmeye kaydır ve o sekmenin en başına dön
  useIsoLayoutEffect(() => {
    const track = trackRef.current;
    const pane = paneRefs.current[index];
    if (!track) return;
    if (pane) pane.scrollTop = 0;
    const left = index * track.clientWidth;
    if (Math.abs(track.scrollLeft - left) > 1) {
      // Anında konumlan: animasyonlu kaydırma snap-always noktalarında erken
      // durabildiği için ray hiçbir zaman ara sayfada bırakılmaz.
      track.scrollTo({ left, behavior: "auto" });
    }
    // Alt menü vurgusu ray konumunu takip etsin
    emitTabScroll(
      track.clientWidth > 0 ? track.scrollLeft / track.clientWidth : index,
    );
  }, [index]);

  // Parmakla kaydırma bir sekmeye oturduysa URL'i eşitle
  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    // Vurgu parmakla eşzamanlı kaysın diye ham (ondalıklı) konum bildirilir
    if (track.clientWidth > 0) {
      emitTabScroll(track.scrollLeft / track.clientWidth);
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const settled = settledTabIndex(
        track.scrollLeft,
        track.clientWidth,
        tabs.length,
      );
      if (settled !== null && settled !== indexRef.current) {
        router.push(tabs[settled].href);
      }
    }, SETTLE_DELAY);
  };

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  return (
    <main className={SHELL.mainPaged}>
      <div ref={trackRef} onScroll={handleScroll} className={SHELL.track}>
        {tabs.map((tab, i) => (
          <div
            key={tab.href}
            ref={(el) => {
              paneRefs.current[i] = el;
            }}
            onMouseDown={preventFocusScroll}
            className={SHELL.pane}
          >
            {mounted[i] || i === index ? <tab.Page /> : null}
          </div>
        ))}
      </div>
    </main>
  );
}
