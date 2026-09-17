"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHELL } from "@/components/layout/shell";
import { onTabScroll } from "@/lib/tabSwipe";

/** Alt menüde kullanılan ikon bileşeni (lucide ikonları) */
export type BottomNavIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
}>;

export interface BottomNavItem {
  href: string;
  icon: BottomNavIcon;
  label: string;
}

/**
 * Müşteri alt navigasyonu. Aktiflik vurgusu rayın kaydırma konumundan gelir:
 * sayfa parmakla kayarken (yarısı sağdaki, yarısı soldaki) ikon rengi de
 * parmakla birlikte iki sekme arasında geçiş yapar.
 */
export default function CustomerBottomNav({ tabs }: { tabs: BottomNavItem[] }) {
  const pathname = usePathname();
  const routeIndex = tabs.findIndex((tab) => pathname.startsWith(tab.href));

  // Raydan gelen ondalıklı konum (0 = ilk sekme, 1.4 = ikisi arası)
  const [scrollPosition, setScrollPosition] = useState<number | null>(null);

  useEffect(() => onTabScroll(setScrollPosition), []);

  // Sekme olmayan sayfalarda (/b/[slug] gibi) hiçbiri aktif gösterilmez
  const position = routeIndex === -1 ? -1 : (scrollPosition ?? routeIndex);

  return (
    // Renkler Tailwind paletinden: indigo-600 / gray-400 (açık), indigo-400 / slate-400 (koyu)
    <nav
      className={`${SHELL.bottomNav} [--tab-accent:#4f39f6] [--tab-muted:#99a1af] dark:[--tab-accent:#7d87ff] dark:[--tab-muted:#90a1b9]`}
    >
      <div className={SHELL.bottomNavInner}>
        {tabs.map((item, i) => {
          // 0 = tam aktif, 1 = tamamen pasif
          const distance =
            position === -1 ? 1 : Math.min(1, Math.abs(position - i));
          const isActive = distance < 0.5;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-gray-400 dark:text-slate-400 transition-transform duration-200 active:scale-90 ${
                isActive ? "font-extrabold" : "font-medium"
              }`}
              style={{
                color: `color-mix(in srgb, var(--tab-accent) ${(1 - distance) * 100}%, var(--tab-muted))`,
              }}
            >
              <item.icon size={22} strokeWidth={1.8 + (1 - distance) * 0.7} />
              <span className="text-[10px] mt-1 tracking-tight leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
