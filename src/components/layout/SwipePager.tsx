"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { SHELL } from "@/components/layout/shell";
import { publishPageSwipeProgress } from "@/components/layout/pageSwipeProgress";
import { triggerHapticFeedback } from "@/lib/haptics";

const AXIS_RATIO = 1.5;
const AXIS_SLOP = 12;
const COMMIT_RATIO = 0.3;
const MAX_DRAG_RATIO = 0.32;
const DAMPING = 0.55;

/* Hızlı kaydırma (flick): kısa bir dokunma/titreme geçiş yapmasın diye hem
   mesafe hem hız aranır. */
const FLICK_MIN_DISTANCE = 80;
const FLICK_VELOCITY = 0.5;

/* Kenar swipe-geri (detay sayfaları): iOS'taki gibi ekranın sol kenarından
   başlayan sağa sürükleme sayfayı parmakla taşır, bırakınca geri gider. */
const BACK_EDGE_WIDTH = 32;
const BACK_COMMIT_RATIO = 0.32;

/** Parmak yeterince uzağa ve yeterince hızlı gittiyse (px, px/ms). */
function isFlick(distance: number, elapsedMs: number) {
  return (
    distance >= FLICK_MIN_DISTANCE &&
    distance / Math.max(1, elapsedMs) >= FLICK_VELOCITY
  );
}

export interface SwipeTab {
  href: string;
  content: ReactNode;
}

interface SwipePagerProps
  extends Omit<React.ComponentPropsWithoutRef<"main">, "children"> {
  /** Sekme içerikleri sürekli mounted kalır; URL yalnızca aktif sekmeyi seçer. */
  tabs: SwipeTab[];
  /** Ana sekmeler dışındaki rotalar (örn. /b/[slug]) burada gösterilir. */
  children: ReactNode;
}

/** n. sekmenin track içindeki yüzde konumu (sekme sayısına göre). */
function pagePercent(index: number, count: number) {
  return (index * 100) / Math.max(1, count);
}

/** Modal, harita ve düzenlenen alanlarda sayfa kaydırmasını devre dışı bırak. */
function hasSwipeBlocker(target: EventTarget | null): boolean {
  let el: Element | null = target instanceof Element ? target : null;
  while (el) {
    if (el.hasAttribute("data-no-swipe") || el.getAttribute("role") === "dialog") {
      return true;
    }

    const tag = el.tagName;
    if (tag === "SELECT") return true;
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

function isMobileViewport() {
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 1023px)").matches;
  }
  return window.innerWidth < 1024;
}

const SwipePager = forwardRef<HTMLElement, SwipePagerProps>(
  function SwipePager({ tabs, className, children, ...mainProps }, forwardedRef) {
    const pathname = usePathname();
    const router = useRouter();
    const mainRef = useRef<HTMLElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const detailRef = useRef<HTMLDivElement | null>(null);
    // Parmakla tamamlanan geçişin hedefi; route bu hedefe gelince animasyon kesilmez.
    const committedHrefRef = useRef<string | null>(null);
    const gestureRef = useRef<{
      tracking: boolean;
      axis: "x" | "y" | null;
      startX: number;
      startY: number;
      startTime: number;
      deltaX: number;
      hScroller: HTMLElement | null;
      handedOff: boolean;
      didDragHorizontal: boolean;
    } | null>(null);
    const backGestureRef = useRef<{
      tracking: boolean;
      axis: "x" | "y" | null;
      startX: number;
      startY: number;
      startTime: number;
      deltaX: number;
      hScroller: HTMLElement | null;
      handedOff: boolean;
    } | null>(null);
    const activeIndex = tabs.findIndex((tab) => tab.href === pathname);
    const activeTab = activeIndex >= 0;
    const basePercent =
      activeIndex >= 0 ? pagePercent(activeIndex, tabs.length) : 0;
    const touchHandlersRef = useRef<{
      start: (event: TouchEvent) => void;
      move: (event: TouchEvent) => void;
      end: () => void;
      cancel: () => void;
    } | null>(null);

    const setRefs = useCallback(
      (node: HTMLElement | null) => {
        mainRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    // Route değişince paneli yeni sekme konumunda, animasyonsuz hizala. Aynı
    // DOM ağacı kaldığı için her sekmenin formu, scroll'u ve harita durumu yaşar.
    useLayoutEffect(() => {
      const track = trackRef.current;
      // Route, parmağın bıraktığı hedefe geldiyse track zaten o konumda. Geçişi
      // yarıda kesmemek için sınıf transitionend'e kadar kalır; aksi halde
      // (ör. alt çubuktan başka sekmeye geçiş) konum doğrudan sıfırlanır.
      const finishingCommit =
        track?.dataset.committing === "true" &&
        committedHrefRef.current === pathname;
      committedHrefRef.current = null;
      if (track && !finishingCommit) {
        track.style.transform = `translate3d(-${basePercent}%, 0, 0)`;
        delete track.dataset.dragging;
        delete track.dataset.settling;
        delete track.dataset.committing;
      }
      // Swipe-geri sonrası detay kabı başka bir detay sayfasında kalabilir
      // (ör. randevu → işletme profili): dönüşüm ve sınıfları sıfırla.
      const detail = detailRef.current;
      if (detail) {
        detail.classList.remove("swipe-back-dragging", "swipe-back-settling");
        detail.style.transform = "";
      }
      backGestureRef.current = null;
    }, [basePercent, pathname]);

    /** Uygulama içi geçmiş varsa geri, yoksa keşfete (paylaşılan linkle
        doğrudan gelen kullanıcı uygulamadan düşmesin). */
    const goBack = useCallback(() => {
      const state = window.history.state as { idx?: number } | null;
      if (state && typeof state.idx === "number" && state.idx > 0) {
        router.back();
      } else {
        router.push("/discover");
      }
    }, [router]);

    const settleBack = useCallback(
      (commit: boolean) => {
        const detail = detailRef.current;
        backGestureRef.current = null;
        if (!detail) return;

        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (commit && reduced) {
          detail.style.transform = "";
          detail.classList.remove("swipe-back-dragging");
          triggerHapticFeedback();
          goBack();
          return;
        }

        const width = mainRef.current?.clientWidth || window.innerWidth;
        detail.classList.remove("swipe-back-dragging");
        detail.classList.add("swipe-back-settling");
        detail.style.transform = commit
          ? `translate3d(${width}px, 0, 0)`
          : "translate3d(0, 0, 0)";

        if (commit) {
          triggerHapticFeedback();
          window.setTimeout(goBack, 190);
        } else {
          window.setTimeout(() => {
            detail.classList.remove("swipe-back-settling");
            detail.style.transform = "";
          }, 260);
        }
      },
      [goBack],
    );

    const publishProgress = (
      phase: "drag" | "settle" | "commit",
      toHref: string | null,
      progress: number,
    ) => {
      const fromHref = tabs[activeIndex]?.href;
      if (!fromHref) return;
      publishPageSwipeProgress({ fromHref, toHref, progress, phase });
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!isMobileViewport()) return;
      if (event.touches.length !== 1 || hasSwipeBlocker(event.target)) return;

      const touch = event.touches[0];

      // Detay sayfası: yalnızca sol kenardan başlayan swipe-geri jesti.
      if (!activeTab) {
        const main = mainRef.current;
        if (!main) return;
        if (touch.clientX - main.getBoundingClientRect().left > BACK_EDGE_WIDTH)
          return;
        backGestureRef.current = {
          tracking: true,
          axis: null,
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: Date.now(),
          deltaX: 0,
          hScroller: findHorizontalScroller(event.target),
          handedOff: false,
        };
        return;
      }

      gestureRef.current = {
        tracking: true,
        axis: null,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        deltaX: 0,
        hScroller: findHorizontalScroller(event.target),
        handedOff: false,
        didDragHorizontal: false,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      // Swipe-geri: detay sayfasını parmakla sağa taşı.
      const back = backGestureRef.current;
      if (back?.tracking) {
        if (event.touches.length !== 1) {
          back.tracking = false;
          if (back.deltaX > 0) settleBack(false);
          else backGestureRef.current = null;
          return;
        }
        const touch = event.touches[0];
        const moveX = touch.clientX - back.startX;
        const moveY = touch.clientY - back.startY;

        if (!back.axis) {
          if (Math.abs(moveX) < AXIS_SLOP && Math.abs(moveY) < AXIS_SLOP)
            return;
          if (moveX > 0 && Math.abs(moveX) > Math.abs(moveY) * AXIS_RATIO) {
            back.axis = "x";
          } else {
            back.tracking = false;
            backGestureRef.current = null;
            return;
          }
        }

        if (back.hScroller && !back.handedOff) {
          // Yatay bir şerit (ör. sekme çubuğu) sola kayabiliyorsa jest ona
          // bırakılır; ancak şerit en baştaysa swipe-geri devralır.
          if (back.hScroller.scrollLeft > 0) {
            back.tracking = false;
            backGestureRef.current = null;
            return;
          }
          back.handedOff = true;
        }

        back.deltaX = Math.max(0, moveX);
        const detail = detailRef.current;
        if (detail) {
          detail.classList.remove("swipe-back-settling");
          detail.classList.add("swipe-back-dragging");
          detail.style.transform = `translate3d(${back.deltaX}px, 0, 0)`;
        }
        return;
      }

      const gesture = gestureRef.current;
      if (!gesture?.tracking) return;
      if (event.touches.length !== 1) {
        gesture.tracking = false;
        if (!gesture.didDragHorizontal) return;
        if (trackRef.current) {
          delete trackRef.current.dataset.dragging;
          trackRef.current.dataset.settling = "true";
          trackRef.current.style.transform = `translate3d(-${basePercent}%, 0, 0)`;
        }
        publishProgress("settle", null, 0);
        return;
      }

      const touch = event.touches[0];
      const moveX = touch.clientX - gesture.startX;
      const moveY = touch.clientY - gesture.startY;

      if (!gesture.axis) {
        if (Math.abs(moveX) < AXIS_SLOP && Math.abs(moveY) < AXIS_SLOP) return;
        if (Math.abs(moveX) > Math.abs(moveY) * AXIS_RATIO) {
          gesture.axis = "x";
        } else {
          gesture.tracking = false;
          return;
        }
      }

      if (gesture.hScroller && !gesture.handedOff) {
        const atStart = gesture.hScroller.scrollLeft <= 0;
        const atEnd =
          gesture.hScroller.scrollLeft + gesture.hScroller.clientWidth >=
          gesture.hScroller.scrollWidth - 2;
        const scrollerCanMove =
          moveX < 0 ? !atEnd : !atStart;
        if (scrollerCanMove) {
          gesture.tracking = false;
          return;
        }
        gesture.handedOff = true;
      }

      gesture.didDragHorizontal = true;
      if (trackRef.current) {
        delete trackRef.current.dataset.settling;
        delete trackRef.current.dataset.committing;
        trackRef.current.dataset.dragging = "true";
      }

      gesture.deltaX = moveX;
      const hasNeighbor =
        moveX < 0
          ? activeIndex < tabs.length - 1
          : activeIndex > 0;
      const resistance = hasNeighbor ? DAMPING : DAMPING * 0.3;
      const width = mainRef.current?.clientWidth || window.innerWidth;
      const limit = width * MAX_DRAG_RATIO;
      const offset = Math.max(-limit, Math.min(limit, moveX * resistance));
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(calc(-${basePercent}% + ${offset}px), 0, 0)`;
      }
      publishProgress(
        "drag",
        hasNeighbor ? tabs[moveX < 0 ? activeIndex + 1 : activeIndex - 1].href : null,
        hasNeighbor ? Math.abs(offset) / width : 0,
      );
    };

    const onTouchEnd = () => {
      const back = backGestureRef.current;
      if (back?.tracking) {
        back.tracking = false;
        if (back.axis !== "x" || back.deltaX <= 0) {
          backGestureRef.current = null;
          return;
        }
        const width = mainRef.current?.clientWidth || window.innerWidth;
        const elapsed = Date.now() - back.startTime;
        const commit =
          back.deltaX > width * BACK_COMMIT_RATIO ||
          isFlick(back.deltaX, elapsed);
        settleBack(commit);
        return;
      }

      const gesture = gestureRef.current;
      if (!gesture?.tracking) return;
      gesture.tracking = false;
      if (!gesture.didDragHorizontal) return;

      const wasHorizontal =
        gesture.axis === "x" && (gesture.handedOff || !gesture.hScroller);
      const deltaX = gesture.deltaX;
      const targetIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1;
      const target = tabs[targetIndex];
      const travelled = Math.abs(deltaX);
      const elapsed = Date.now() - gesture.startTime;
      const width = mainRef.current?.clientWidth || window.innerWidth;
      const farEnough = travelled > width * COMMIT_RATIO;
      const quickFlick = isFlick(travelled, elapsed);

      if (!wasHorizontal || !target || (!farEnough && !quickFlick)) {
        publishProgress("settle", target?.href ?? null, 0);
        if (trackRef.current) {
          delete trackRef.current.dataset.dragging;
          if (wasHorizontal && deltaX !== 0) {
            trackRef.current.dataset.settling = "true";
          } else {
            delete trackRef.current.dataset.settling;
          }
          trackRef.current.style.transform = `translate3d(-${basePercent}%, 0, 0)`;
        }
        return;
      }

      // Komşu panel gerçek DOM'da zaten hazırdır. Track doğrudan hedef sekmenin
      // yüzdesine kayar: route geldiğinde yazılan değerle aynıdır, geçiş bölünmez.
      publishProgress("commit", target.href, 1);
      committedHrefRef.current = target.href;
      if (trackRef.current) {
        delete trackRef.current.dataset.dragging;
        trackRef.current.dataset.committing = "true";
        trackRef.current.style.transform = `translate3d(-${pagePercent(
          targetIndex,
          tabs.length,
        )}%, 0, 0)`;
      }
      triggerHapticFeedback();
      router.push(target.href);
    };

    touchHandlersRef.current = {
      start: onTouchStart,
      move: onTouchMove,
      end: onTouchEnd,
      cancel: () => {
        const back = backGestureRef.current;
        if (back?.tracking) {
          back.tracking = false;
          if (back.deltaX > 0) settleBack(false);
          else backGestureRef.current = null;
          return;
        }
        const gesture = gestureRef.current;
        gestureRef.current = null;
        if (!gesture?.didDragHorizontal) return;

        const toHref =
          gesture.deltaX === 0
            ? null
            : tabs[
                gesture.deltaX < 0 ? activeIndex + 1 : activeIndex - 1
              ]?.href ?? null;
        publishProgress("settle", toHref, 0);
        if (trackRef.current) {
          delete trackRef.current.dataset.dragging;
          trackRef.current.dataset.settling = "true";
          trackRef.current.style.transform = `translate3d(-${basePercent}%, 0, 0)`;
        }
      },
    };

    useLayoutEffect(() => {
      const main = mainRef.current;
      if (!main) return;
      const onTouchStart = (event: TouchEvent) =>
        touchHandlersRef.current?.start(event);
      const onTouchMove = (event: TouchEvent) =>
        touchHandlersRef.current?.move(event);
      const onTouchEnd = () => touchHandlersRef.current?.end();
      const onTouchCancel = () => touchHandlersRef.current?.cancel();
      main.addEventListener("touchstart", onTouchStart, { passive: true });
      main.addEventListener("touchmove", onTouchMove, { passive: true });
      main.addEventListener("touchend", onTouchEnd, { passive: true });
      main.addEventListener("touchcancel", onTouchCancel, { passive: true });
      return () => {
        main.removeEventListener("touchstart", onTouchStart);
        main.removeEventListener("touchmove", onTouchMove);
        main.removeEventListener("touchend", onTouchEnd);
        main.removeEventListener("touchcancel", onTouchCancel);
      };
    }, []);

    const trackWidth = Math.max(1, tabs.length) * 100;

    return (
      <main
        ref={setRefs}
        {...mainProps}
        className={`${className ?? ""} relative overflow-hidden`}
      >
        <div
          aria-hidden={!activeTab}
          className={`absolute inset-0 h-full min-h-0 w-full overflow-hidden ${
            activeTab ? "" : "invisible pointer-events-none"
          }`}
        >
          <div
            ref={trackRef}
            className="swipe-pager-track flex h-full min-h-0"
            onTransitionEnd={(event) => {
              if (
                event.target === event.currentTarget &&
                event.propertyName === "transform"
              ) {
                delete event.currentTarget.dataset.settling;
                delete event.currentTarget.dataset.committing;
              }
            }}
            style={{
              width: `${trackWidth}%`,
              transform: `translate3d(-${basePercent}%, 0, 0)`,
              touchAction: "pan-y",
            }}
          >
            {tabs.map((tab, index) => (
              <section
                key={tab.href}
                aria-label={tab.href}
                aria-hidden={activeIndex !== index}
                inert={!activeTab || activeIndex !== index}
                className="swipe-pager-page h-full min-h-0 shrink-0"
                style={{ width: `${100 / Math.max(1, tabs.length)}%` }}
              >
                <div className={SHELL.tabPane}>{tab.content}</div>
              </section>
            ))}
          </div>
        </div>
        {!activeTab && (
          <div
            ref={detailRef}
            className="absolute inset-0 h-full min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar p-3 sm:p-6 md:p-8 pb-24 sm:pb-24 lg:pb-8 pr-2.5 sm:pr-4"
            style={{ touchAction: "pan-y" }}
          >
            {children}
          </div>
        )}
      </main>
    );
  },
);

export default SwipePager;
