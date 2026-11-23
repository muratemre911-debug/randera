"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/haptics";

/**
 * Native uygulama tarzı "aşağı çek, yenile" jesti.
 *
 * İçeriği sarmalar; en yakın kaydırılabilir atasını (sekme paneli) bulur ve
 * yalnızca panel en üstteyken aşağı yönlü sürüklemeyi dinler. Eşik aşılınca
 * bırakıldığında `onRefresh` çalışır; gösterge o sırada dönmeye devam eder.
 * Yatay swipe (sekme geçişi) ve dikey kaydırma ile çakışmaz: jest ancak
 * aşağı yön baskınken ve panel scrollTop === 0 iken sahiplenilir.
 */

const THRESHOLD = 56;
const MAX_PULL = 92;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
  disabled?: boolean;
  /** Ekran okuyucu için yenileme durumu metni. */
  refreshingLabel?: string;
}

export default function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  refreshingLabel = "Yenileniyor...",
}: PullToRefreshProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);
  const gestureRef = useRef({
    startY: 0,
    startX: 0,
    decided: false,
    active: false,
    pull: 0,
  });

  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || disabled) return;

    // En yakın kaydırılabilir ata (SHELL.tabPane veya detay kaydırma kabı).
    let scroller: HTMLElement | null = wrap.parentElement;
    while (scroller && scroller !== document.body) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === document.body) return;
    const pane = scroller;

    const onStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1) return;
      if (pane.scrollTop > 0) return;
      const touch = event.touches[0];
      gestureRef.current = {
        startY: touch.clientY,
        startX: touch.clientX,
        decided: false,
        active: false,
        pull: 0,
      };
    };

    const onMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (refreshingRef.current || (gesture.decided && !gesture.active)) return;
      if (event.touches.length !== 1) {
        gesture.decided = true;
        gesture.active = false;
        return;
      }

      const touch = event.touches[0];
      const dy = touch.clientY - gesture.startY;
      const dx = touch.clientX - gesture.startX;

      if (!gesture.decided) {
        if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return;
        if (dy > 0 && dy > Math.abs(dx) * 1.2 && pane.scrollTop <= 0) {
          gesture.decided = true;
          gesture.active = true;
          setDragging(true);
        } else {
          gesture.decided = true;
          gesture.active = false;
          return;
        }
      }

      if (pane.scrollTop > 0) {
        gesture.active = false;
        gesture.decided = true;
        setDragging(false);
        setPull(0);
        return;
      }

      // Panel en üstte ve jest bizde: tarayıcı kaydırmasını durdur.
      event.preventDefault();
      const damped = Math.min(MAX_PULL, Math.max(0, dy) * 0.45);
      gesture.pull = damped;
      setPull(damped);
    };

    const onEnd = async () => {
      const gesture = gestureRef.current;
      if (!gesture.active) return;
      gesture.active = false;
      gesture.decided = true;
      setDragging(false);

      if (gesture.pull >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        triggerHapticFeedback();
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    pane.addEventListener("touchstart", onStart, { passive: true });
    pane.addEventListener("touchmove", onMove, { passive: false });
    pane.addEventListener("touchend", onEnd);
    pane.addEventListener("touchcancel", onEnd);
    return () => {
      pane.removeEventListener("touchstart", onStart);
      pane.removeEventListener("touchmove", onMove);
      pane.removeEventListener("touchend", onEnd);
      pane.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled]);

  const height = refreshing ? THRESHOLD : pull;

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height,
          transition: dragging
            ? "none"
            : "height 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        aria-hidden={height === 0}
      >
        <RefreshCw
          size={20}
          strokeWidth={2.4}
          className={
            refreshing
              ? "animate-spin text-[var(--brand)]"
              : pull >= THRESHOLD
                ? "text-[var(--brand)]"
                : "text-slate-400 dark:text-slate-500"
          }
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${Math.round(pull * 4)}deg)` }
          }
        />
      </div>
      {refreshing && (
        <span role="status" className="sr-only">
          {refreshingLabel}
        </span>
      )}
      {children}
    </div>
  );
}
