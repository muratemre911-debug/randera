import { Users, CalendarDays, TrendingUp, DollarSign, Clock, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Genel Bakış</h1>
        <p className="mt-2 text-lg text-gray-500 dark:text-slate-400">İşletmenizin bugünkü özeti.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {/* Widget 1: Revenue */}
        <div className="col-span-2 md:col-span-2 row-span-2 rounded-[32px] border border-white/40 bg-gradient-to-br from-white/80 to-white/40 p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:from-slate-800/80 dark:to-slate-900/40 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-transform hover:scale-[1.02] duration-300 flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <DollarSign size={28} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Günlük Ciro</p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">₺4,250</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full">
            <TrendingUp size={16} />
            <span>Düne göre %12 artış</span>
          </div>
        </div>

        {/* Widget 2: Appointments */}
        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 mb-3">
            <CalendarDays size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Bekleyen Randevu</p>
        </div>

        {/* Widget 3: New Clients */}
        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 mb-3">
            <Users size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">5</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Yeni Müşteri</p>
        </div>

        {/* Widget 4: Upcoming Next */}
        <div className="col-span-2 rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 flex items-center gap-4 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <Clock size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Sıradaki Randevu</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">Ahmet Yılmaz • Saç Kesimi</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-amber-500">14:30</p>
            <p className="text-sm font-medium text-gray-400">15 dk kaldı</p>
          </div>
        </div>
      </div>
    </div>
  );
}
