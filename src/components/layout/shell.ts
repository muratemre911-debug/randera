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
  root: "fixed inset-0 overflow-hidden p-2 sm:p-4 md:p-6 flex gap-2 sm:gap-4 md:gap-6 bg-slate-50 dark:bg-[#0B0D14]",

  /** Masaüstü yüzen sidebar kartı (w-64 = 256px) */
  sidebar:
    "hidden lg:flex w-64 shrink-0 flex-col rounded-[28px] bg-white/60 backdrop-blur-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:static lg:h-full dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] select-none",

  /** Sidebar'ın sağındaki dikey kolon (header + main) */
  column: "flex-1 flex flex-col h-full min-h-0 gap-2 sm:gap-4 md:gap-6 overflow-hidden relative z-10",

  /** Yüzen header (tema / dil / bildirim ve marka alanı) */
  header:
    "shrink-0 z-30 flex h-14 sm:h-16 items-center justify-between rounded-2xl sm:rounded-[28px] border border-white/50 bg-white/60 backdrop-blur-3xl px-3.5 sm:px-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900/60 dark:border-slate-700/50 dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all",

  /** İçerik kartı (kaydırılabilir sayfa alanı) */
  main: "flex-1 min-h-0 rounded-2xl sm:rounded-[28px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/50 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-y-auto overflow-x-hidden custom-scrollbar p-3 sm:p-6 md:p-8 pb-24 sm:pb-24 lg:pb-8 pr-2.5 sm:pr-4 relative z-0",

  /** Mobil alt navigasyon çubuğu */
  bottomNav:
    "fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-t border-gray-200/80 dark:border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-1.5 px-3 select-none",

  /** Mobil alt navigasyon iç genişliği (her iki panelde aynı) */
  bottomNavInner: "flex items-center justify-around max-w-md mx-auto",
} as const;
