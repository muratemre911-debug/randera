"use client";

import { useEffect, useState, useMemo } from "react";
import { CalendarDays, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/CustomSelect";

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

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3.5 backdrop-blur-2xl shadow-xs dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {lang === "tr" ? "Hizmet" : "Service"}
            </label>
            <CustomSelect
              value={filterService}
              onChange={(val) => setFilterService(val)}
              options={[
                { value: "", label: lang === "tr" ? "Tüm Hizmetler" : "All Services" },
                ...services.map((s) => ({
                  value: s.id,
                  label: s.name,
                  badge: `₺${s.price}`,
                })),
              ]}
              buttonClassName="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all cursor-pointer"
              placeholder={lang === "tr" ? "Tüm Hizmetler" : "All Services"}
              searchPlaceholder={lang === "tr" ? "Hizmet ara..." : "Search services..."}
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {lang === "tr" ? "Başlangıç Tarihi" : "Start Date"}
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {lang === "tr" ? "Bitiş Tarihi" : "End Date"}
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white"
            />
          </div>

          {hasFilter && (
            <div className="self-end pb-0.5">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
              >
                <X size={16} />
                {lang === "tr" ? "Temizle" : "Clear"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Sabit Hafif Gri Başlık Satırı */}
            <thead className="select-none">
              <tr className="border-b border-slate-200 bg-slate-100/70 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="py-3.5 px-5">{lang === "tr" ? "Tarih" : "Date"}</th>
                <th className="py-3.5 px-5">{lang === "tr" ? "Müşteri" : "Customer"}</th>
                <th className="py-3.5 px-5">{lang === "tr" ? "Hizmet" : "Service"}</th>
                <th className="py-3.5 px-5 text-right">{lang === "tr" ? "Tutar" : "Price"}</th>
                <th className="py-3.5 px-5 text-center">{lang === "tr" ? "Durum" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span>{lang === "tr" ? "Yükleniyor..." : "Loading..."}</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 px-4">
                    <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/20">
                        <CalendarDays className="h-10 w-10 stroke-[1.75]" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {hasFilter
                          ? (lang === "tr" ? "Filtrelere uygun randevu bulunamadı" : "No appointments match filters")
                          : (lang === "tr" ? "Henüz geçmiş randevunuz yok" : "No past appointments yet")}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {hasFilter
                          ? (lang === "tr" ? "Farklı bir tarih aralığı veya hizmet seçerek tekrar deneyebilirsiniz." : "Try selecting a different date range or service.")
                          : (lang === "tr" ? "Tamamlanan veya geçen randevularınız bu tabloda arşivlenecektir." : "Completed or past appointments will appear here.")}
                      </p>
                      {hasFilter && (
                        <button
                          onClick={clearFilters}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                          <X size={14} />
                          {lang === "tr" ? "Filtreleri Sıfırla" : "Reset Filters"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Tarih */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">
                        {formatDate(a.start_time)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatTime(a.start_time)}
                      </div>
                    </td>
                    {/* Müşteri */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {getCustomerName(a)}
                      </div>
                      {a.profiles?.phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {a.profiles.phone}
                        </div>
                      )}
                    </td>
                    {/* Hizmet */}
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {a.services?.name || (lang === "tr" ? "Hizmet" : "Service")}
                      </span>
                    </td>
                    {/* Tutar */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₺{a.services?.price ?? 0}
                      </span>
                    </td>
                    {/* Durum */}
                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50">
                        {lang === "tr" ? "Tamamlandı" : "Completed"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
