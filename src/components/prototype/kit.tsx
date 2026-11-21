/**
 * Arayüz yenilemesi önizlemesi için yeniden kullanılabilir parçalar.
 *
 * Bu dosya YALNIZCA `/taslak` önizleme rotasında kullanılır; canlı ekranlara
 * dokunulmadan önce tasarımın onaylanması için görsel örnek üretir.
 */
import React from "react";

/** Kart yüzeyi: net zemin + yumuşak gölge (cam efekti içeriklerde kullanılmaz). */
export function MockCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Bölüm başlığı: kalın başlık + tek satırlık ipucu. */
export function MockSectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
          {title}
        </h3>
        {hint && (
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Birincil eylem butonu. */
export function MockPrimary({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_6px_16px_var(--brand-shadow)] ${className}`}
    >
      {children}
    </span>
  );
}

/** İkincil eylem butonu. */
export function MockSecondary({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${className}`}
    >
      {children}
    </span>
  );
}

/** Filtre/etiket hapı. */
export function MockChip({
  children,
  active = false,
  icon,
}: {
  children: React.ReactNode;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
        active
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Küçük fotoğraf karesi. */
export function MockThumb({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- önizleme görseli
    <img
      src={src}
      alt=""
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}

/** Durum rozeti (randevu durumu). */
export function MockStatus({
  label,
  tone,
}: {
  label: string;
  tone: "pending" | "confirmed" | "completed" | "cancelled";
}) {
  const tones = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    confirmed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    completed:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  } as const;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

/** Önizleme alt navigasyon çubuğu (yalnızca mobil). */
export function MockBottomNav({
  items,
  active,
}: {
  items: { label: string; icon: React.ReactNode }[];
  active: number;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/85 pt-1.5 backdrop-blur-2xl @3xl:hidden dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex items-center justify-around">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`flex flex-1 flex-col items-center gap-1 py-1.5 ${
              i === active
                ? "text-[var(--brand)]"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-bold">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Önizleme kabuğu: masaüstünde sidebar, mobilde alt navigasyon.
 * Gerçek uygulamadaki kabuk yapısının sadeleştirilmiş karşılığı.
 */
export function MockShell({
  children,
  nav,
  active,
}: {
  children: React.ReactNode;
  nav: { label: string; icon: React.ReactNode }[];
  active: number;
}) {
  return (
    <div className="flex min-h-full bg-slate-50 dark:bg-[#0B0D14]">
      {/* Masaüstü sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/70 p-4 dark:border-slate-800 @3xl:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-black text-white shadow-[0_6px_14px_var(--brand-shadow)]">
            R
          </span>
          <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
            Randera
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {nav.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold ${
                i === active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>

        <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800/70">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-black text-white">
              E
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                Emre Yılmaz
              </p>
              <p className="truncate text-[10px] font-semibold text-[var(--brand-text)]">
                Müşteri hesabı
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* İçerik + mobil alt menü */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0 flex-1">{children}</div>
        <MockBottomNav items={nav} active={active} />
      </div>
    </div>
  );
}


/** Önizleme üst çubuğu (arama vb.). */
export function MockTopBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}
