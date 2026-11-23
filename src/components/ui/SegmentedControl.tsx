"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { triggerHapticFeedback } from "@/lib/haptics";

/**
 * iOS tarzı kayan kapsüllü segmented control.
 *
 * Seçili bölmenin arkasındaki beyaz "thumb" parmak dokunuşunda yumuşak bir
 * yay eğrisiyle kayar; Keşfet (Liste/Harita) ve Randevularım (Yaklaşan/Geçmiş)
 * sekmelerinde ortak kullanılır. Ölçüm MobileBottomNav ile aynı desendedir:
 * offsetLeft/offsetWidth + ResizeObserver.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  badge?: ReactNode;
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const active = itemRefs.current.get(value);
    if (!active) return;
    setThumb({ x: active.offsetLeft, w: active.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    const observer =
      container && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (container) observer?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, options.length]);

  return (
    <div
      ref={containerRef}
      role="group"
      className={`relative isolate flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 ${className}`}
    >
      {/* Kayan kapsül */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-0 z-0 rounded-[9px] bg-white shadow-[0_2px_8px_rgb(15,23,42,0.10)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-slate-700 dark:shadow-black/25"
        style={{
          width: thumb?.w ?? 0,
          transform: `translate3d(${thumb?.x ?? 0}px, 0, 0)`,
          opacity: thumb ? 1 : 0,
        }}
      />
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) itemRefs.current.set(option.value, node);
              else itemRefs.current.delete(option.value);
            }}
            type="button"
            aria-pressed={isActive}
            aria-label={option.ariaLabel}
            onClick={() => {
              if (isActive) return;
              triggerHapticFeedback();
              onChange(option.value);
            }}
            className={`relative z-10 flex min-h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors duration-200 sm:text-sm ${
              isActive
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {Icon && (
              <Icon
                size={15}
                strokeWidth={2.4}
                className="shrink-0"
              />
            )}
            <span className="truncate">{option.label}</span>
            {option.badge != null && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors sm:text-[11px] ${
                  isActive
                    ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                    : "bg-slate-200/70 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400"
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
