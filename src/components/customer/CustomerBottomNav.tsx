"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHELL } from "@/components/layout/shell";

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
 * Müşteri alt navigasyonu.
 */
export default function CustomerBottomNav({ tabs }: { tabs: BottomNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className={SHELL.bottomNav}>
      <div className={SHELL.bottomNavInner}>
        {tabs.map((item) => {
          const isActive =
            item.href === "/discover"
              ? pathname === "/discover" || pathname.startsWith("/discover/")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-transform duration-200 active:scale-90 ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                  : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
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
