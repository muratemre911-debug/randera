export function Skeleton({ className = "", style, ...rest }: { className?: string; style?: React.CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`}
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