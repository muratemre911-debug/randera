/**
 * Ortak uygulama kabuğu (app shell) ölçüleri.
 *
 * İşletme paneli (`/dashboard/*`) ve müşteri alanı (`/discover`, `/favorites`,
 * `/my-appointments`, `/profile`, `/b/*`) AYNI ölçüleri kullanmak zorundadır.
 * Sidebar (Keşfet / Favorilerim ...), header (tema, dil, bildirim) ve mobil alt
 * navigasyon boyutları burada tek bir yerden yönetilir; böylece iki panel
 * arasında boyut farkı oluşamaz.
 */
export const SHELL = {
 /** Tüm ekranı kaplayan, dış boşluk ve mesh gradient zemini sağlayan kök kapsayıcı */
 root:
 "fixed inset-0 overflow-clip overscroll-none flex gap-2 sm:gap-4 md:gap-6 bg-slate-50 dark:bg-[#0B0D14] shell-root",

 /** Masaüstü yüzen sidebar kartı (w-64 = 256px) */
 sidebar:
  "hidden lg:flex w-64 shrink-0 flex-col rounded-[28px] bg-white/60 backdrop-blur-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:static lg:h-full dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] select-none min-w-0",

 /**
  * Sidebar'ın sağındaki dikey kolon (header + main).
  *
  * `min-w-0` ŞART: flex öğelerinin varsayılan otomatik minimum genişliği
  * (`min-width: auto`) içeriğin min-content genişliğidir. `overflow: clip` bunu
  * tarayıcıda sıfırlamadığı için, içindeki sayfa (ör. `max-w-6xl` bir grid)
  * min-content olarak ~1150px dayatıyor ve tüm kabuk ekrandan ~3 kat geniş
  * taşıyordu: header'ın sağındaki tema/dil/bildirim düğmeleri ekran dışına
  * itiliyor, sayfa içeriği kırpılıyor ve swipe eşikleri yanlış hesaplanıyordu.
  */
 column:
  "flex-1 min-w-0 flex flex-col h-full min-h-0 gap-2 sm:gap-4 md:gap-6 overflow-clip overscroll-none relative z-10 shell-column",

 /** Yüzen header (tema / dil / bildirim ve marka alanı) */
 header:
  "shrink-0 z-30 flex h-14 sm:h-16 min-w-0 items-center justify-between rounded-2xl sm:rounded-[28px] border border-white/50 bg-white/60 backdrop-blur-3xl px-3.5 sm:px-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all",

 /** İçerik kartı (kaydırılabilir sayfa alanı) */
 main:
  "flex-1 min-w-0 min-h-0 rounded-2xl sm:rounded-[28px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/50 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar p-3 sm:p-6 md:p-8 pb-24 sm:pb-24 lg:pb-8 pr-2.5 sm:pr-4 relative z-0",

 /** Mobil alt navigasyon çubuğu */
 bottomNav:
 "fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-t border-gray-200/80 dark:border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] pt-1.5 select-none shell-bottomnav",

  /** Mobil alt navigasyon iç genişliği (her iki panelde aynı) */
  bottomNavInner: "flex items-center justify-around max-w-md mx-auto",
} as const;

/** Alt navigasyon çubuğunun göründüğü yol önekleri. */
const BOTTOM_NAV_PREFIXES = [
  "/discover",
  "/favorites",
  "/my-appointments",
  "/profile",
  "/dashboard",
];

/**
 * Verilen yol için alt navigasyon çubuğu görünür mü?
 * Yüzen bileşenlerin (ör. PWA kurulum daveti) dikey konumu buna göre seçilir.
 * Randevu alma akışında alt menü bilinçli olarak gizlenir (bkz. (customer)/layout.tsx).
 */
export function hasBottomNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.includes("/randevu")) return false;
  return BOTTOM_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
