"use client";

import { useEffect, useState, useMemo } from "react";
import { History, CalendarDays, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface PastAppointment {
  id: string;
  service_id: string;
  customer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  custom_fields: Record<string, string> | null;
  services: Service | null;
  profiles: { full_name: string; phone: string | null } | null;
}

export default function GecmisRandevularPage() {
  const supabase = createClient();
  const { lang } = useLanguage();

  const [appointments, setAppointments] = useState<PastAppointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterService, setFilterService] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      if (!profile) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      const [apptRes, svcRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, services(name, price), profiles!appointments_customer_id_fkey(full_name, phone)")
          .eq("tenant_id", profile.tenant_id)
          .neq("status", "cancelled")
          .lt("start_time", now)
          .order("start_time", { ascending: false }),
        supabase
          .from("services")
          .select("id, name, price")
          .eq("tenant_id", profile.tenant_id)
          .order("name"),
      ]);

      if (apptRes.data) setAppointments(apptRes.data as PastAppointment[]);
      if (svcRes.data) setServices(svcRes.data as Service[]);
      setLoading(false);
    };

    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const start = new Date(a.start_time);
      const matchService = !filterService || a.service_id === filterService;
      const matchFrom = !filterFrom || start >= new Date(`${filterFrom}T00:00:00`);
      const matchTo = !filterTo || start <= new Date(`${filterTo}T23:59:59`);
      return matchService && matchFrom && matchTo;
    });
  }, [appointments, filterService, filterFrom, filterTo]);

  const getCustomerName = (a: PastAppointment) =>
    a.profiles?.full_name || a.custom_fields?.customer_name || (lang === "tr" ? "Bilinmeyen Müşteri" : "Unknown Customer");

  const hasFilter = filterService || filterFrom || filterTo;

  const clearFilters = () => {
    setFilterService("");
    setFilterFrom("");
    setFilterTo("");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(lang === "tr" ? "tr-TR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {lang === "tr" ? "Geçmiş Randevular" : "Past Appointments"}
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
          {filtered.length}{" "}
          {lang === "tr" ? "randevu listeleniyor" : "appointments listed"}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              {lang === "tr" ? "Hizmet" : "Service"}
            </label>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="rounded-xl border-0 bg-white/50 px-4 py-2.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50"
            >
              <option value="">{lang === "tr" ? "Tüm Hizmetler" : "All Services"}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              {lang === "tr" ? "Başlangıç Tarihi" : "From"}
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-xl border-0 bg-white/50 px-4 py-2.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              {lang === "tr" ? "Bitiş Tarihi" : "To"}
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-xl border-0 bg-white/50 px-4 py-2.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50"
            />
          </div>

          {hasFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
            >
              <X size={16} />
              {lang === "tr" ? "Temizle" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-[32px] border border-white/50 bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-900/60">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
            {lang === "tr" ? "Yükleniyor..." : "Loading..."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
              <History className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {hasFilter
                ? lang === "tr"
                  ? "Filtrelere uygun randevu bulunamadı."
                  : "No appointments match your filters."
                : lang === "tr"
                  ? "Henüz geçmiş randevunuz yok."
                  : "No past appointments yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((a, index) => (
              <div key={a.id} className="group relative">
                {index !== 0 && (
                  <div className="absolute top-0 right-0 left-[64px] h-[1px] bg-gray-200/50 dark:bg-slate-700/50" />
                )}
                <div className="flex items-center justify-between p-4 pl-5 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">
                        {getCustomerName(a)}
                      </h3>
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                        {a.services?.name || (lang === "tr" ? "Hizmet" : "Service")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                      {formatDate(a.start_time)} · {formatTime(a.start_time)}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      ₺{a.services?.price ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
