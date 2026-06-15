"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  CalendarDays,
  Clock,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";


const HOURS = Array.from({ length: 10 }, (_, i) => i + 9);

interface Profile {
  id: string;
  full_name: string;
}

type ViewMode = "today" | "weekly" | "monthly";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}

interface Appointment {
  id: string;
  service_id: string;
  customer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  custom_fields: Record<string, string>;
  services?: Service;
}



function getWeekDays(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const TR_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export default function TakvimPage() {
  const supabase = createClient();
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<{
    day: Date;
    hour: number;
  } | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);

  const [formCustomer, setFormCustomer] = useState("");
  const [formService, setFormService] = useState("");
  const [editingApptId, setEditingApptId] = useState<string | null>(null);

  const getCustomerName = (app: Appointment) => {
    const cust = customers.find(c => c.id === app.customer_id);
    return cust ? cust.full_name : (app.custom_fields?.customer_name || "Müşteri");
  };

  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);

  const days = useMemo(() => {
    switch (viewMode) {
      case "today":
        return [currentDate];
      case "weekly":
        return getWeekDays(currentDate);
      case "monthly":
        return getMonthDays(currentDate);
    }
  }, [viewMode, currentDate]);

  const dateRange = useMemo(() => {
    if (days.length === 0) return { start: "", end: "" };
    const start = new Date(days[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(days[days.length - 1]);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [days]);

  const todayApptsCount = appointments.filter(a => isSameDay(new Date(a.start_time), new Date())).length;
  const pendingCount = appointments.filter(a => a.status === "confirmed" && new Date(a.start_time) > new Date()).length;
  
  const occupancyPercent = useMemo(() => {
    if (days.length === 0) return 0;
    const totalSlots = days.length * HOURS.length;
    const filledSlots = appointments.filter(a => days.some(d => isSameDay(d, new Date(a.start_time)))).length;
    return Math.round((filledSlots / totalSlots) * 100);
  }, [days, appointments]);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile) {
      setLoading(false);
      return;
    }
    setTenantId(profile.tenant_id);

    const [apptRes, svcRes, custRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, services(name, duration, price)")
        .eq("tenant_id", profile.tenant_id)
        .neq("status", "cancelled")
        .gte("start_time", dateRange.start)
        .lte("start_time", dateRange.end)
        .order("start_time"),
      supabase
        .from("services")
        .select("id, name, duration, price")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", profile.tenant_id)
        .eq("role", "customer")
        .order("full_name"),
    ]);
    if (apptRes.data) setAppointments(apptRes.data as Appointment[]);
    if (svcRes.data) setServices(svcRes.data);
    if (custRes.data) setCustomers(custRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [dateRange.start, dateRange.end]);

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    switch (viewMode) {
      case "today":
        d.setDate(d.getDate() + dir);
        break;
      case "weekly":
        d.setDate(d.getDate() + 7 * dir);
        break;
      case "monthly":
        d.setMonth(d.getMonth() + dir);
        break;
    }
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const getApptsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.start_time), day));

  const getApptsForSlot = (day: Date, hour: number) =>
    appointments.filter((a) => {
      const start = new Date(a.start_time);
      return isSameDay(start, day) && start.getHours() === hour;
    });



  const scrollToAppointment = useCallback(
    (targetDayIndex: number, targetHour: number) => {
      setViewMode("weekly");
      const el = document.querySelector(
        `[data-cell="${targetDayIndex}-${targetHour}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedCell(`${targetDayIndex}-${targetHour}`);
        setTimeout(() => setHighlightedCell(null), 2000);
      }
    },
    [],
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !formService || !formCustomer) return;
    setSaving(true);

    const service = services.find((s) => s.id === formService);
    if (!service) return;

    const start = new Date(selectedSlot.day);
    start.setHours(selectedSlot.hour, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + service.duration);

    if (editingApptId) {
      const { error } = await supabase.from("appointments").update({
        customer_id: formCustomer,
        service_id: formService,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      }).eq("id", editingApptId);

      if (!error) {
        setSelectedSlot(null);
        setEditingApptId(null);
        setFormCustomer("");
        setFormService("");
        fetchData();
      }
    } else {
      const { error } = await supabase.from("appointments").insert({
        tenant_id: tenantId,
        customer_id: formCustomer,
        service_id: formService,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        custom_fields: {},
      });

      if (!error) {
        setSelectedSlot(null);
        setFormCustomer("");
        setFormService("");
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!selectedAppointment) return;
    if (!confirm("Bu randevuyu silmek istediğinize emin misiniz?")) return;
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", selectedAppointment.id);

    if (!error) {
      setSelectedAppointment(null);
      fetchData();
    }
  };

  const headerLabel = useMemo(() => {
    switch (viewMode) {
      case "today":
        return `${days[0]?.getDate()} ${TR_MONTHS[days[0]?.getMonth()]} ${days[0]?.getFullYear()}`;
      case "weekly": {
        const first = days[0];
        const last = days[days.length - 1];
        return `${first?.getDate()} ${TR_MONTHS[first?.getMonth()]} - ${last?.getDate()} ${TR_MONTHS[last?.getMonth()]} ${last?.getFullYear()}`;
      }
      case "monthly":
        return `${TR_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  }, [viewMode, days, currentDate]);

  const renderMonthGrid = () => (
    <div className="overflow-hidden rounded-[32px] border border-white/50 bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
      <div className="grid grid-cols-7 border-b border-gray-200/50 dark:border-slate-700/50">
        {TR_LABELS.map((l) => (
          <div
            key={l}
            className="border-r border-gray-200/50 px-2 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-400 last:border-r-0 dark:border-slate-700/50"
          >
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {getMonthDays(currentDate).map((day) => {
          const dayAppts = getApptsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] border-b border-r border-gray-200/50 p-2 transition-colors hover:bg-white/40 dark:border-slate-700/50 dark:hover:bg-slate-800/40 ${
                isToday ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""
              }`}
            >
              <div className="flex justify-center mb-1">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold ${
                    isToday
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "text-gray-900 dark:text-slate-200"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {dayAppts.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAppointment(a)}
                    className="w-full truncate rounded-lg bg-indigo-100/80 px-2 py-1 text-[11px] font-semibold text-indigo-800 backdrop-blur-md hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:hover:bg-indigo-500/30 transition-colors"
                  >
                    {formatTime(a.start_time)} {getCustomerName(a)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20">
              <CalendarDays size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Bugün Randevu</p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{todayApptsCount}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 dark:bg-amber-500/20">
              <Clock size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Bekleyen</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{pendingCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/40 bg-white/60 p-5 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-800/60 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20">
              <TrendingUp size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Doluluk</p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">%{occupancyPercent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white min-w-[200px]">
            {headerLabel}
          </h1>
          <div className="flex items-center gap-1 rounded-full border border-white/50 bg-white/50 p-1 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/50">
            <button
              onClick={() => navigate(-1)}
              className="rounded-full p-2 text-gray-600 transition-colors hover:bg-white/80 active:scale-90 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={goToday}
              className="rounded-full px-4 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:bg-white/80 active:scale-95 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Bugün
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-full p-2 text-gray-600 transition-colors hover:bg-white/80 active:scale-90 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-white/50 bg-white/50 p-1 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/50">
            {(["today", "weekly", "monthly"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  viewMode === mode
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                    : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {mode === "today"
                  ? "Gün"
                  : mode === "weekly"
                    ? "Hafta"
                    : "Ay"}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setEditingApptId(null);
              setFormCustomer("");
              setFormService("");
              setSelectedSlot({ day: new Date(), hour: new Date().getHours() });
            }}
            className="flex items-center justify-center rounded-full bg-indigo-600 h-11 w-11 text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-90"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className={`transition-opacity duration-300 relative ${loading ? "opacity-50 pointer-events-none" : ""}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-full bg-white/80 p-3 shadow-lg backdrop-blur-sm dark:bg-slate-800/80">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            </div>
          </div>
        )}

        {viewMode === "monthly" && renderMonthGrid()}

        {viewMode !== "monthly" && (
        <div className="overflow-hidden rounded-[32px] border border-white/50 bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
          {/* Day headers */}
          <div className="flex border-b border-gray-200/50 dark:border-slate-700/50">
            <div className="w-16 shrink-0" />
            {days.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={i}
                  className={`flex flex-1 flex-col items-center border-l border-gray-200/50 py-4 dark:border-slate-700/50 ${
                    isToday ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""
                  }`}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"}`}>
                    {TR_LABELS[day.getDay()]}
                  </span>
                  <span
                    className={`mt-1.5 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-all ${
                      isToday
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50 relative">
            {HOURS.map((hour) => (
              <div key={hour} className="flex min-h-[80px]">
                <div className="flex w-16 shrink-0 items-start justify-center pt-3">
                  <span className="text-[13px] font-semibold text-gray-400 dark:text-slate-500">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
                {days.map((day, dayIndex) => {
                  const cellId = `${dayIndex}-${hour}`;
                  const realApps = getApptsForSlot(day, hour);
                  const hasContent = realApps.length > 0;
                  const isHighlighted = highlightedCell === cellId;

                  return (
                    <div
                      key={dayIndex}
                      data-cell={cellId}
                      className={`flex flex-1 border-l border-gray-200/50 p-1 transition-all dark:border-slate-700/50 hover:bg-white/40 dark:hover:bg-slate-800/40 cursor-pointer ${
                        isSameDay(day, new Date())
                          ? "bg-indigo-50/30 dark:bg-indigo-900/5"
                          : ""
                      } ${isHighlighted ? "ring-2 ring-inset ring-amber-400 bg-amber-50 dark:bg-amber-900/20" : ""}`}
                      onClick={(e) => {
                         if (e.target === e.currentTarget) {
                            setEditingApptId(null);
                            setFormCustomer("");
                            setFormService("");
                            setSelectedSlot({ day, hour });
                         }
                      }}
                    >
                      {hasContent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAppointment(realApps[0]);
                          }}
                          className="w-full rounded-2xl p-2.5 text-left transition-all hover:scale-[0.98] bg-indigo-100/90 text-indigo-900 border border-indigo-200 shadow-sm backdrop-blur-md dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/30"
                        >
                          <p className="text-[13px] font-bold mb-0.5 leading-tight">
                            {realApps[0]?.services?.name || "Randevu"}
                          </p>
                          <p className="text-[11px] font-medium opacity-80 leading-tight">
                            {getCustomerName(realApps[0])}
                          </p>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Create Appointment Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-md bg-black/20 dark:bg-black/40 transition-opacity"
            onClick={() => setSelectedSlot(null)}
          />
          <div className="relative w-full max-w-md rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-3xl dark:border-slate-700/50 dark:bg-slate-900/80 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingApptId ? "Randevuyu Düzenle" : "Yeni Etkinlik"}
              </h2>
              <button
                onClick={() => setSelectedSlot(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-6 rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-500/10">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
                {TR_LABELS[selectedSlot.day.getDay()]}, {selectedSlot.day.getDate()} {TR_MONTHS[selectedSlot.day.getMonth()]}
              </p>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {selectedSlot.hour.toString().padStart(2, "0")}:00
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Müşteri Seçimi
                </label>
                <select
                  required
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                >
                  <option value="">Müşteri seçin...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Hizmet Seçimi
                </label>
                <select
                  required
                  value={formService}
                  onChange={(e) => setFormService(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                >
                  <option value="">Hizmet seçin...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (₺{s.price})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-8 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-full bg-indigo-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : (editingApptId ? "Güncelle" : "Ekle")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-md bg-black/20 dark:bg-black/40 transition-opacity"
            onClick={() => setSelectedAppointment(null)}
          />
          <div className="relative w-full max-w-sm rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-3xl dark:border-slate-700/50 dark:bg-slate-900/80 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Detaylar
              </h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-3xl bg-indigo-50 p-4 dark:bg-indigo-500/10">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-md shadow-indigo-500/30">
                  {getCustomerName(selectedAppointment)
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {getCustomerName(selectedAppointment)}
                  </p>
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    {selectedAppointment.services?.name || "Hizmet"}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 rounded-3xl bg-white/50 p-4 shadow-inner border border-white/40 dark:bg-slate-800/50 dark:border-slate-700/50">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Tarih</p>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-slate-100">
                    {new Date(
                      selectedAppointment.start_time,
                    ).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Saat</p>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-slate-100">
                    {formatTime(selectedAppointment.start_time)} -{" "}
                    {formatTime(selectedAppointment.end_time)}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => {
                    const start = new Date(selectedAppointment.start_time);
                    setEditingApptId(selectedAppointment.id);
                    setFormCustomer(selectedAppointment.customer_id);
                    setFormService(selectedAppointment.service_id);
                    setSelectedSlot({ day: start, hour: start.getHours() });
                    setSelectedAppointment(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-indigo-500/10 px-4 py-3.5 text-base font-bold text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-400"
                >
                  <Edit2 size={18} strokeWidth={2.5} />
                  Düzenle
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-red-500/10 px-4 py-3.5 text-base font-bold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
