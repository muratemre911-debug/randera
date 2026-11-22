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
const MIN_DISTANCE = 48;
const QUICK_MS = 500;
const COMMIT_RATIO = 0.18;
const MAX_DRAG_RATIO = 0.32;
const DAMPING = 0.55;

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
    const activeIndex = tabs.findIndex((tab) => tab.href === pathname);
    const activeTab = activeIndex >= 0;
    const basePercent =
      activeIndex >= 0 ? (activeIndex * 100) / Math.max(1, tabs.length) : 0;
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
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(-${basePercent}%, 0, 0)`;
        delete trackRef.current.dataset.dragging;
        delete trackRef.current.dataset.settling;
        delete trackRef.current.dataset.committing;
      }
    }, [basePercent, pathname]);

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
      if (!activeTab || !isMobileViewport()) return;
      if (event.touches.length !== 1 || hasSwipeBlocker(event.target)) return;

      const touch = event.touches[0];
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
      const farEnough =
        travelled > Math.max(MIN_DISTANCE, width * COMMIT_RATIO);
      const quickFlick = elapsed < QUICK_MS && travelled > MIN_DISTANCE;

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

      // Komşu panel gerçek DOM'da zaten hazırdır; track parmağın yönünde
      // tamamlanırken Next URL'si de güncellenir.
      publishProgress("commit", target.href, 1);
      if (trackRef.current) {
        delete trackRef.current.dataset.dragging;
        trackRef.current.dataset.committing = "true";
        trackRef.current.style.transform = `translate3d(calc(-${basePercent}% + ${
          deltaX < 0 ? -width : width
        }px), 0, 0)`;
      }
      triggerHapticFeedback();
      router.push(target.href);
    };

    touchHandlersRef.current = {
      start: onTouchStart,
      move: onTouchMove,
      end: onTouchEnd,
      cancel: () => {
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
          <div className="absolute inset-0 h-full min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar p-3 sm:p-6 md:p-8 pb-24 sm:pb-24 lg:pb-8 pr-2.5 sm:pr-4">
            {children}
          </div>
        )}
      </main>
    );
  },
);

export default SwipePager;
