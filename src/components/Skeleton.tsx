export function Skeleton({ className = "", style, ...rest }: { className?: string; style?: React.CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`skeleton rounded ${className}`}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full mb-2" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`p-6 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 ${className}`}>
      <Skeleton className="h-6 w-1/4 mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonAvatar({ size = "h-12 w-12", className = "" }: { size?: string; className?: string }) {
  return (
    <Skeleton className={`rounded-full ${size} ${className}`} />
  );
}

export function SkeletonTableRow({ columns = 4, className = "" }: { columns?: number; className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function SkeletonDashboardWidget({ className = "" }: { className?: string }) {
  return (
    <div className={`p-6 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-6 w-1/3 rounded-full" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <Skeleton className="h-10 w-1/4 mb-2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        <SkeletonDashboardWidget className="col-span-2 md:col-span-2 row-span-2" />
        <SkeletonDashboardWidget />
        <SkeletonDashboardWidget />
        <SkeletonDashboardWidget className="col-span-2" />
      </div>
    </div>
  );
}

export function BusinessPageSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12">
      <Skeleton className="w-full h-48 md:h-56 rounded-[28px] mb-4" />
      <div className="px-4 md:px-6">
        <div className="flex items-start gap-4 mb-4">
          <SkeletonAvatar size="h-24 w-24 md:h-28 md:w-28" className="shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-8 w-1/2 mb-3" />
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
        <Skeleton className="h-12 w-full sm:w-48 rounded-full" />
      </div>
      <div>
        <Skeleton className="h-6 w-1/4 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Keşfet / Favoriler listesi için satır iskeletleri (mobil + masaüstü). */
export function BusinessListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      {/* Mobil satırlar */}
      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-9 w-16 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
      {/* Masaüstü kartlar */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-7">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/70 dark:border-slate-800/70 dark:bg-slate-900/60"
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="-mt-12 h-16 w-16 rounded-full border-4 border-white dark:border-slate-900" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Keşfet sayfası: başlık, arama, filtreler ve görselli işletme kartları. */
export function DiscoverSkeleton() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20" aria-busy="true">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 w-24 rounded-xl" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[56, 80, 72, 96, 64, 88].map((w, i) => (
            <Skeleton key={i} className="h-8 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[26px] border border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900"
          >
            <Skeleton className="h-[210px] w-full rounded-none sm:h-[260px] lg:aspect-video lg:h-auto" />
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
              <Skeleton className="h-4 w-1/2" />
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-28 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Randevularım sayfası iskeleti. */
export function AppointmentsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16 sm:space-y-8" aria-busy="true">
      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 px-5 py-5 dark:border-white/10 dark:bg-slate-900/70 sm:px-7 sm:py-7">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-9 w-56 max-w-full mb-3" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex gap-3.5">
            <Skeleton className="h-24 w-[66px] shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <Skeleton className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Randevu alma sihirbazı iskeleti. */
export function BookingSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-5 px-4 pb-4 lg:space-y-6 lg:px-2" aria-busy="true">
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full sm:h-14 sm:w-14" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:p-5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Profil sayfası iskeleti. */
export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-1 py-4 sm:px-2 sm:py-7" aria-busy="true">
      <div className="mb-6 space-y-2 sm:mb-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/85 dark:border-white/10 dark:bg-slate-900/75">
        <Skeleton className="h-28 w-full rounded-none" />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-10 mb-7 flex items-end gap-4">
            <Skeleton className="h-[92px] w-[92px] shrink-0 rounded-[28px] border-4 border-white dark:border-slate-900" />
            <Skeleton className="mb-2 h-5 w-32" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <Skeleton className="mt-6 h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function Spinner({ size = "h-8 w-8", className = "", color = "text-indigo-600" }: { size?: string; className?: string; color?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg className={`${size} animate-spin ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );
}

export function LoadingOverlay({ message = "Yükleniyor..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 text-center">
        <Spinner size="h-12 w-12" className="mx-auto mb-4" />
        <p className="text-slate-600 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}
