"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Yatay kaydırma (swipe) ile sekmeler arasında geçiş yapan sayfa kabı.
 *
 * Neden gerekli: uygulama tek bir sabit kabuk (fixed shell) içinde çalışır ve
 * alt navigasyon sekmeleri arasında geçiş yalnızca tıklamayla yapılabiliyordu.
 * Dokunmatikte parmakla sayfa çevirmek, uygulamayı "yerel uygulama" gibi
 * hissettiren en temel hareketlerden biri.
 *
 * Davranış kuralları (mobil tarayıcıyla çakışmamak için kritik):
 *  - Kaydırma yalnızca listedeki TAM eşleşen sekmelerde çalışır; alt sayfalarda
 *    (işletme detayı, randevu akışı) devre dışı kalır.
 *  - Yatay niyet, dikey hareketin en az {@link AXIS_RATIO} katı olmalı; aksi
 *    halde jest dikey kaydırmaya bırakılır.
 *  - Yatay kaydırılabilir bir öğe (ör. filtre çipleri) veya harita üzerinde
 *    başlayan jestler yok sayılır — oralarda kendi kaydırması çalışsın.
 *  - `data-no-swipe` taşıyan torunlar (modallar, harita) jesti engeller.
 *  - Masaüstünde hiçbir etkisi yoktur (yalnızca dokunma olayları dinlenir).
 */

const AXIS_RATIO = 1.35; // yatay niyet eşiği
const AXIS_SLOP = 8; // karar vermeden önceki ölü bölge (px)
const MIN_DISTANCE = 48; // en az bu kadar sürüklenmeli (px)
const QUICK_MS = 500; // hızlı "flick" süresi (ms)
const COMMIT_RATIO = 0.18; // genişliğin bu oranı geçilirse geçiş yapılır
const MAX_DRAG_RATIO = 0.32; // fazla sürüklemeyi sınırla
const DAMPING = 0.55; // parmağın altında yumuşak takip
const EXIT_MS = 170; // sayfadan çıkış animasyonu
const ENTER_MS = 300; // yeni sayfanın giriş animasyonu

export interface SwipeTab {
  href: string;
}

interface SwipePagerProps
  extends Omit<React.ComponentPropsWithoutRef<"main">, "children"> {
  /** Kaydırmayla gezilebilecek sekmeler, görsel sırayla. */
  tabs: SwipeTab[];
  children: ReactNode;
}

/** Modal / harita / düzenlenen alan gibi jesti engelleyen atalar var mı? */
function hasSwipeBlocker(target: EventTarget | null): boolean {
  let el: Element | null = target instanceof Element ? target : null;
  while (el) {
    if (el.hasAttribute("data-no-swipe")) return true;
    if (el.getAttribute("role") === "dialog") return true;

    const tag = el.tagName;
    // `select`: yerel seçici açılır, dokunma jesti ona ait.
    if (tag === "SELECT") return true;
    // Metin alanları: YALNIZCA o an düzenleniyorsa (odaktaysa) engellenir.
    // Aksi halde profil gibi form ağırlıklı sayfalarda kaydırma jesti
    // tamamen ölürdi — odakta olmayan bir alanda yatay sürükleme zaten
    // yapılacak bir şey değil.
    if (
      (tag === "INPUT" || tag === "TEXTAREA") &&
      el === document.activeElement
    ) {
      return true;
    }

    el = el.parentElement;
  }
  return false;
}

/** Jest, yatay kaydırılabilir bir alanın üzerinde mi başladı? */
function findHorizontalScroller(target: EventTarget | null): HTMLElement | null {
  let el: Element | null = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 4) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return el;
    }
    el = el.parentElement;
  }
  return null;
}

const SwipePager = forwardRef<HTMLElement, SwipePagerProps>(
  function SwipePager({ tabs, className, children, ...mainProps }, ref) {
    const pathname = usePathname();
    const router = useRouter();
    const paneRef = useRef<HTMLElement | null>(null);
    const [enterFrom, setEnterFrom] = useState<"left" | "right" | null>(null);

    // Yalnızca tam eşleşen sekme yollarında kaydırma açılır.
    const index = tabs.findIndex((tab) => tab.href === pathname);

    const setRefs = useCallback(
      (node: HTMLElement | null) => {
        paneRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    // Sayfa değiştiğinde kabı hemen başlangıç konumuna al: yeni sayfa, çıkış
    // animasyonunun bittiği kaydırılmış konumda bir kare bile görünmemeli.
    // (useLayoutEffect: tarayıcı boyamadan önce çalışır.)
    useLayoutEffect(() => {
      const pane = paneRef.current;
      if (!pane) return;
      pane.style.transition = "none";
      pane.style.transform = "translate3d(0,0,0)";
    }, [pathname]);

    // Giriş animasyonu bitince sınıfı kaldır (animasyon transform'u sıfırlar).
    useEffect(() => {
      if (!enterFrom) return;
      const timer = window.setTimeout(() => setEnterFrom(null), ENTER_MS);
      return () => window.clearTimeout(timer);
    }, [enterFrom]);

    // Komşu sekme yolları efekt bağımlılığı olarak kullanılır (dizi kimliği her
    // render'da değişebildiği için doğrudan `tabs`'a bağlanmak efekti sürekli
    // yeniden kurardı).
    const previousHref = index > 0 ? tabs[index - 1].href : null;
    const nextHref = index >= 0 && index < tabs.length - 1 ? tabs[index + 1].href : null;

    useEffect(() => {
      const pane = paneRef.current;
      if (!pane || index < 0) return;

      const previous = previousHref ? { href: previousHref } : undefined;
      const next = nextHref ? { href: nextHref } : undefined;

      let tracking = false;
      let axis: "x" | "y" | null = null;
      let startX = 0;
      let startY = 0;
      let startTime = 0;
      let deltaX = 0;
      /** Jest yatay kaydırılabilir bir alanda başladıysa o alan. */
      let hScroller: HTMLElement | null = null;
      /**
       * Kenar devri (edge handoff): yatay kaydırılabilir alan kendi ucuna
       * ulaştıysa jest sayfaya devredilir. Böylece takvim/filtre çubuğu gibi
       * alanlar hem kendi içinde kaydırılır hem de sona gelindiğinde sekme
       * değiştirilebilir (yerel uygulamalardaki davranış).
       */
      let handedOff = false;

      const paneWidth = () => pane.clientWidth || window.innerWidth;

      const clearTransform = () => {
        pane.style.transition = "";
        pane.style.transform = "";
      };

      const settleBack = () => {
        pane.style.transition = `transform 230ms cubic-bezier(0.22, 1, 0.36, 1)`;
        pane.style.transform = "translate3d(0,0,0)";
        window.setTimeout(clearTransform, 250);
      };

      const abort = () => {
        tracking = false;
        axis = null;
        handedOff = false;
        hScroller = null;
        clearTransform();
      };

      const onTouchStart = (event: TouchEvent) => {
        if (event.touches.length !== 1) return;
        if (hasSwipeBlocker(event.target)) return;

        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        deltaX = 0;
        axis = null;
        handedOff = false;
        hScroller = findHorizontalScroller(event.target);
        tracking = true;
        pane.style.transition = "none";
      };

      const onTouchMove = (event: TouchEvent) => {
        if (!tracking) return;
        if (event.touches.length !== 1) {
          abort();
          return;
        }

        const touch = event.touches[0];
        const moveX = touch.clientX - startX;
        const moveY = touch.clientY - startY;

        if (!axis) {
          if (Math.abs(moveX) < AXIS_SLOP && Math.abs(moveY) < AXIS_SLOP) return;
          if (Math.abs(moveX) > Math.abs(moveY) * AXIS_RATIO) {
            axis = "x";
          } else {
            // Dikey kaydırma: jesti tamamen bırak.
            abort();
            return;
          }
        }

        // Yatay kaydırılabilir bir alan varsa: yalnızca o alan kendi ucuna
        // dayanmışsa jest sayfaya geçer; aksi halde kaydırmayı o üstlenir.
        if (hScroller && !handedOff) {
          const atStart = hScroller.scrollLeft <= 0;
          const atEnd =
            hScroller.scrollLeft + hScroller.clientWidth >=
            hScroller.scrollWidth - 2;
          const wantsLeft = moveX < 0;
          const scrollerCanMove = wantsLeft ? !atEnd : !atStart;
          if (scrollerCanMove) {
            abort();
            return;
          }
          handedOff = true;
        }

        deltaX = moveX;
        const target = deltaX < 0 ? next : previous;
        // Karşı sekme yoksa neredeyse hiç hareket etmesin (kenarda direnç).
        const resistance = target ? DAMPING : DAMPING * 0.3;
        const limit = paneWidth() * MAX_DRAG_RATIO;
        const shifted = Math.max(
          -limit,
          Math.min(limit, deltaX * resistance),
        );

        pane.style.transform = `translate3d(${shifted}px,0,0)`;
      };

      const onTouchEnd = () => {
        if (!tracking) return;
        const wasHorizontal = axis === "x" && (handedOff || !hScroller);
        tracking = false;
        axis = null;

        if (!wasHorizontal) {
          clearTransform();
          return;
        }

        const target = deltaX < 0 ? next : previous;
        const travelled = Math.abs(deltaX);
        const elapsed = Date.now() - startTime;
        const farEnough =
          travelled > Math.max(MIN_DISTANCE, paneWidth() * COMMIT_RATIO);
        const quickFlick = elapsed < QUICK_MS && travelled > MIN_DISTANCE;

        if (!target || (!farEnough && !quickFlick)) {
          settleBack();
          return;
        }

        // Hedef sayfaya doğru kaydır, sonra rotayı değiştir.
        const exitTo = deltaX < 0 ? -paneWidth() : paneWidth();
        pane.style.transition = `transform ${EXIT_MS}ms ease-out`;
        pane.style.transform = `translate3d(${exitTo}px,0,0)`;
        setEnterFrom(deltaX < 0 ? "right" : "left");

        window.setTimeout(() => {
          router.push(target.href);
        }, EXIT_MS);
      };

      pane.addEventListener("touchstart", onTouchStart, { passive: true });
      pane.addEventListener("touchmove", onTouchMove, { passive: true });
      pane.addEventListener("touchend", onTouchEnd, { passive: true });
      pane.addEventListener("touchcancel", abort, { passive: true });

      return () => {
        pane.removeEventListener("touchstart", onTouchStart);
        pane.removeEventListener("touchmove", onTouchMove);
        pane.removeEventListener("touchend", onTouchEnd);
        pane.removeEventListener("touchcancel", abort);
        clearTransform();
      };
    }, [index, previousHref, nextHref, router]);

    return (
      <main
        ref={setRefs}
        {...mainProps}
        className={`${className ?? ""} ${
          enterFrom === "right"
            ? "animate-swipe-in-right"
            : enterFrom === "left"
              ? "animate-swipe-in-left"
              : ""
        }`}
      >
        {children}
      </main>
    );
  },
);

export default SwipePager;
