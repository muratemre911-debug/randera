"use client";

import MobileBottomNav, {
  type MobileNavIcon,
  type MobileNavItem,
} from "@/components/layout/MobileBottomNav";

/** Alt menüde kullanılan ikon bileşeni (lucide ikonları) */
export type BottomNavIcon = MobileNavIcon;

export type BottomNavItem = MobileNavItem;

/**
 * Müşteri alt navigasyonu.
 */
export default function CustomerBottomNav({ tabs }: { tabs: BottomNavItem[] }) {
  return (
    <MobileBottomNav
      tabs={tabs}
      ariaLabel="Müşteri menüsü"
    />
  );
}
