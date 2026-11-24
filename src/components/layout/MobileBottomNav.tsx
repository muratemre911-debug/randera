"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SHELL } from "@/components/layout/shell";
import { triggerHapticFeedback } from "@/lib/haptics";
import {
  PAGE_SWIPE_PROGRESS_EVENT,
  type PageSwipeProgress,
} from "@/components/layout/pageSwipeProgress";

export type MobileNavIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export interface MobileNavItem {
  href: string;
  icon: MobileNavIcon;
  label: string;
  isActive?: (pathname: string) => boolean;
}

export interface MobileNavAction {
  icon: MobileNavIcon;
  label: string;
  onSelect: () => void;
  active?: boolean;
}

interface MobileBottomNavProps {
  tabs: MobileNavItem[];
  action?: MobileNavAction;
  ariaLabel: string;
}

interface ActivePointer {
  id: number;
  startX: number;
  startY: number;
  index: number;
  moved: boolean;
}

interface NavItemMetrics {
  left: number;
  width: number;
}

function isMobileViewport() {
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 1023px)").matches;
  }
  return window.innerWidth < 1024;
}

export default function MobileBottomNav({
  tabs,
  action,
  ariaLabel,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<ActivePointer | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const itemMetricsRef = useRef<NavItemMetrics[]>([]);
  const navLeftRef = useRef(0);
  const navWidthRef = useRef(0);
  const tabsRef = useRef(tabs);
  const pathnameRef = useRef(pathname);

  const routeIndex = tabs.findIndex((item) =>
    item.isActive
      ? item.isActive(pathname)
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const activeIndex = action?.active
    ? tabs.length
    : routeIndex >= 0
      ? routeIndex
      : -1;
  // Seçim daima gerçek URL'den türetilir; sürükleme göstergesi doğrudan DOM
  // ölçüsüyle taşınır, böylece React render'ı parmak konumunu geri alamaz.
  const visualIndex = activeIndex;
  const visualIndexRef = useRef(visualIndex);

  useLayoutEffect(() => {
    tabsRef.current = tabs;
    pathnameRef.current = pathname;
    visualIndexRef.current = visualIndex;
  }, [pathname, tabs, visualIndex]);

  const getItemElements = useCallback(() => {
    return Array.from(
      navRef.current?.querySelectorAll<HTMLElement>("[data-nav-index]") ?? [],
    );
  }, []);

  const measureItems = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const navRect = nav.getBoundingClientRect();
    if (navRect.width <= 0) return;
    navLeftRef.current = navRect.left;
    navWidthRef.current = nav.clientWidth || navRect.width;
    itemMetricsRef.current = getItemElements().map((item) => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left - navRect.left, width: rect.width };
    });
  }, [getItemElements]);

  const setIndicatorPosition = useCallback(
    (index: number, pointerX?: number, stretch = 1) => {
      const nav = navRef.current;
      const item = itemMetricsRef.current[index];
      if (!nav || !item) return;

      const navWidth = nav.clientWidth || navWidthRef.current;
      const indicatorWidth = Math.max(0, item.width - 8);
      const inset = (item.width - indicatorWidth) / 2;
      const rawLeft =
        pointerX === undefined
          ? item.left + inset
          : Math.max(
              4,
              Math.min(
                Math.max(4, navWidth - indicatorWidth - 4),
                pointerX - navLeftRef.current - indicatorWidth / 2,
              ),
            );
      const left = Math.round(rawLeft * 2) / 2;

      nav.style.setProperty("--shell-nav-x", `${left}px`);
      nav.style.setProperty("--shell-nav-width", `${indicatorWidth}px`);
      nav.style.setProperty(
        "--shell-nav-stretch",
        String(Math.max(1, Math.min(1.22, stretch))),
      );
    },
    [],
  );

  const setIndicatorBetween = useCallback(
    (fromIndex: number, toIndex: number, progress: number) => {
      const nav = navRef.current;
      const fromItem = itemMetricsRef.current[fromIndex];
      const toItem = itemMetricsRef.current[toIndex];
      if (!nav || !fromItem || !toItem) return;

      const width = Math.max(0, fromItem.width - 8);
      const fromLeft = fromItem.left + (fromItem.width - width) / 2;
      const toLeft = toItem.left + (toItem.width - width) / 2;
      const amount = Math.max(0, Math.min(1, progress));
      const left =
        Math.round((fromLeft + (toLeft - fromLeft) * amount) * 2) / 2;
      const stretch = 1 + 0.14 * Math.sin(Math.PI * amount);

      nav.style.setProperty("--shell-nav-x", `${left}px`);
      nav.style.setProperty("--shell-nav-width", `${width}px`);
      nav.style.setProperty("--shell-nav-stretch", String(stretch));
    },
    [],
  );

  const syncLayout = useCallback(() => {
    measureItems();
    if (!pointerRef.current && visualIndexRef.current >= 0) {
      setIndicatorPosition(visualIndexRef.current);
    }
  }, [measureItems, setIndicatorPosition]);

  useLayoutEffect(() => {
    measureItems();
    const nav = navRef.current;
    const observer =
      nav && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncLayout)
        : null;
    if (nav) observer?.observe(nav);
    window.addEventListener("resize", syncLayout);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncLayout);
    };
  }, [measureItems, syncLayout, tabs.length]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (navRef.current) {
        navRef.current.dataset.ready = "true";
      }
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (pointerRef.current) return;
    const nav = navRef.current;
    if (nav) {
      delete nav.dataset.dragging;
      delete nav.dataset.settling;
      delete nav.dataset.pageDragging;
      delete nav.dataset.pageSettling;
    }
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (visualIndex < 0) {
      nav?.style.setProperty("--shell-nav-width", "0px");
      return;
    }
    setIndicatorPosition(visualIndex);
  }, [setIndicatorPosition, visualIndex, tabs.length]);

  useEffect(() => {
    const onPageSwipeProgress = (event: Event) => {
      if (pointerRef.current) return;
      const detail = (event as CustomEvent<PageSwipeProgress>).detail;
      const currentTabs = tabsRef.current;
      const nav = navRef.current;
      if (!nav || !detail) return;

      const fromIndex = currentTabs.findIndex(
        (tab) => tab.href === detail.fromHref,
      );
      const toIndex = detail.toHref
        ? currentTabs.findIndex((tab) => tab.href === detail.toHref)
        : -1;

      if (detail.phase === "drag" || detail.phase === "commit") {
        if (fromIndex < 0 || toIndex < 0) return;
        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        delete nav.dataset.settling;
        delete nav.dataset.pageSettling;
        nav.dataset.pageDragging = "true";
        setIndicatorBetween(fromIndex, toIndex, detail.progress);
        return;
      }

      if (detail.phase !== "settle") return;

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      delete nav.dataset.pageDragging;
      delete nav.dataset.settling;
      nav.dataset.pageSettling = "true";
      const active = currentTabs.findIndex((tab) =>
        tab.isActive
          ? tab.isActive(pathnameRef.current)
          : pathnameRef.current === tab.href ||
            pathnameRef.current.startsWith(`${tab.href}/`),
      );
      const restoreIndex = fromIndex >= 0 ? fromIndex : active;
      if (restoreIndex >= 0) setIndicatorPosition(restoreIndex);

      settleTimerRef.current = window.setTimeout(() => {
        if (!pointerRef.current && navRef.current) {
          delete navRef.current.dataset.pageSettling;
        }
        settleTimerRef.current = null;
      }, 240);
    };

    window.addEventListener(PAGE_SWIPE_PROGRESS_EVENT, onPageSwipeProgress);
    return () => {
      window.removeEventListener(PAGE_SWIPE_PROGRESS_EVENT, onPageSwipeProgress);
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, [setIndicatorBetween, setIndicatorPosition]);

  const findItemIndex = useCallback(
    (clientX: number) => {
      const items = itemMetricsRef.current;
      if (!items.length) return -1;

      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      items.forEach((item, index) => {
        const left = item.left + navLeftRef.current;
        if (clientX >= left && clientX <= left + item.width) {
          nearest = index;
          nearestDistance = 0;
          return;
        }
        const center = left + item.width / 2;
        const distance = Math.abs(clientX - center);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      return nearest;
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType === "mouse" ||
      !event.isPrimary ||
      !isMobileViewport()
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest<HTMLElement>("[data-nav-index]");
    if (!item) return;

    const index = Number(item.dataset.navIndex);
    if (!Number.isInteger(index)) return;

    measureItems();
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    suppressClickRef.current = false;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }

    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY ?? 0,
      index,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const dx = event.clientX - pointer.startX;
    const dy = (event.clientY ?? 0) - pointer.startY;

    if (!pointer.moved) {
      if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 12) {
        pointerRef.current = null;
        return;
      }
      if (Math.abs(dx) <= 8) return;

      pointer.moved = true;
      navRef.current?.setPointerCapture?.(event.pointerId);
      if (navRef.current) {
        delete navRef.current.dataset.settling;
        delete navRef.current.dataset.pageSettling;
        delete navRef.current.dataset.pageDragging;
        navRef.current.dataset.dragging = "true";
      }
    }

    const index = findItemIndex(event.clientX);
    if (index < 0) return;

    pointer.index = index;
    setIndicatorPosition(index, event.clientX, 1);
  };

  const finishPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    pointerRef.current = null;
    if (!pointer.moved) return;

    const nav = navRef.current;
    if (nav) {
      try {
        nav.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may not have been active or already released.
      }
      delete nav.dataset.dragging;
      nav.dataset.settling = "true";
    }

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      if (!pointerRef.current && navRef.current) {
        delete navRef.current.dataset.settling;
      }
      settleTimerRef.current = null;
    }, 240);

    if (cancelled) {
      if (activeIndex >= 0) {
        setIndicatorPosition(activeIndex);
      } else {
        nav?.style.setProperty("--shell-nav-width", "0px");
      }
      return;
    }

    const destination = pointer.index;
    setIndicatorPosition(destination);

    suppressClickRef.current = true;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 120);

    if (destination < tabs.length) {
      const target = tabs[destination];
      const isTargetActive = target.isActive
        ? target.isActive(pathname)
        : pathname === target.href;
      if (!isTargetActive) {
        triggerHapticFeedback();
        router.push(target.href);
      }
    } else if (destination === tabs.length && action) {
      triggerHapticFeedback();
      action.onSelect();
    }
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
  };

  return (
    <nav className={SHELL.bottomNav} aria-label={ariaLabel}>
      <div
        ref={navRef}
        className={SHELL.bottomNavInner}
        style={
          {
            "--shell-nav-count": tabs.length + Number(Boolean(action)),
          } as React.CSSProperties
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={(event) => finishPointer(event, true)}
        onClickCapture={onClickCapture}
      >
        <span className="shell-nav-indicator" aria-hidden="true" />
        {tabs.map((item, index) => {
          const isActive = visualIndex === index;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-index={index}
              aria-current={activeIndex === index ? "page" : undefined}
              className={`shell-nav-item ${
                isActive ? "shell-nav-item-active" : ""
              }`}
            >
              <item.icon
                size={21}
                strokeWidth={isActive ? 2.4 : 1.8}
                className="shell-nav-icon"
              />
              <span className="shell-nav-label">{item.label}</span>
            </Link>
          );
        })}
        {action && (
          <button
            type="button"
            data-nav-index={tabs.length}
            data-nav-action
            aria-pressed={action.active || undefined}
            aria-label={action.label}
            onClick={action.onSelect}
            className={`shell-nav-item ${
              visualIndex === tabs.length ? "shell-nav-item-active" : ""
            }`}
          >
            <action.icon
              size={21}
              strokeWidth={visualIndex === tabs.length ? 2.4 : 1.8}
              className="shell-nav-icon"
            />
            <span className="shell-nav-label">{action.label}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
