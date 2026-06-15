"use client";

import { useEffect, useState } from "react";
import { Users, CalendarDays, TrendingUp, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    dailyRevenue: 0,
    pendingAppointments: 0,
    newCustomers: 0,
    nextAppointment: null as any,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile) return;
      const tId = profile.tenant_id;

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 1. Daily Revenue
      const { data: todayAppts } = await supabase
        .from("appointments")
        .select("*, services(price)")
        .eq("tenant_id", tId)
        .neq("status", "cancelled")
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());

      const dailyRev = todayAppts?.reduce((sum, app) => sum + (app.services?.price || 0), 0) || 0;

      // 2. Pending Appointments
      const { count: pendingCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tId)
        .eq("status", "confirmed")
        .gte("start_time", now.toISOString());

      // 3. New Customers
      const { count: newCustCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tId)
        .eq("role", "customer")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // 4. Next Appointment
      const { data: nextApptList } = await supabase
        .from("appointments")
        .select("*, services(name)")
        .eq("tenant_id", tId)
        .eq("status", "confirmed")
        .gte("start_time", now.toISOString())
        .order("start_time", { ascending: true })
        .limit(1);

      let nextAppt = nextApptList?.[0] || null;
      if (nextAppt && nextAppt.customer_id) {
        const { data: custData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", nextAppt.customer_id)
          .single();
        nextAppt.customer_name = custData?.full_name || nextAppt.custom_fields?.customer_name || "Müşteri";
      }

      setStats({
        dailyRevenue: dailyRev,
        pendingAppointments: pendingCount || 0,
        newCustomers: newCustCount || 0,
        nextAppointment: nextAppt,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const getMinutesLeft = (isoString: string) => {
    const diff = new Date(isoString).getTime() - new Date().getTime();
    return Math.max(0, Math.floor(diff / 60000));
  };

  return (
    <div className={`space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ${loading ? "opacity-50" : ""}`}>
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
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">₺{stats.dailyRevenue.toLocaleString('tr-TR')}</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full">
            <CheckCircle2 size={16} />
            <span>Bugün için hesaplandı</span>
          </div>
        </div>

        {/* Widget 2: Appointments */}
        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 mb-3">
            <CalendarDays size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingAppointments}</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">İleri Tarihli Randevu</p>
        </div>

        {/* Widget 3: New Clients */}
        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 mb-3">
            <Users size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.newCustomers}</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Son 30 Gün Yeni Müşteri</p>
        </div>

        {/* Widget 4: Upcoming Next */}
        <div className="col-span-2 rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 flex items-center gap-4 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <Clock size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Sıradaki Randevu</p>
            {stats.nextAppointment ? (
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[250px]">
                {stats.nextAppointment.customer_name} • {stats.nextAppointment.services?.name || "Hizmet"}
              </p>
            ) : (
              <p className="text-lg font-bold text-gray-400 dark:text-slate-500">Randevu yok</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {stats.nextAppointment ? (
              <>
                <p className="text-xl font-extrabold text-amber-500">{formatTime(stats.nextAppointment.start_time)}</p>
                <p className="text-sm font-medium text-gray-400">{getMinutesLeft(stats.nextAppointment.start_time)} dk kaldı</p>
              </>
            ) : (
              <p className="text-xl font-extrabold text-gray-300 dark:text-slate-600">--:--</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
