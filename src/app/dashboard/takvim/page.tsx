"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Phone,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/CustomSelect";

const dayNames = ["pazar", "pazartesi", "sali", "carsamba", "persembe", "cuma", "cumartesi"];

interface WorkingDay {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface WorkingHours {
  [key: string]: WorkingDay;
}

function getDayHours(date: Date, workingHours: WorkingHours | null): number[] {
  if (!workingHours) return Array.from({ length: 12 }, (_, i) => i + 9);
  
  const dayName = dayNames[date.getDay()];
  const hours = workingHours[dayName];
  
  if (!hours || !hours.isOpen) return [];
  
  const openHour = parseInt(hours.openTime.split(":")[0]);
  const closeHour = parseInt(hours.closeTime.split(":")[0]);
  
  return Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
}

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
  profiles?: {
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
  };
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

const EN_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function TakvimPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();
  const LABELS = lang === "tr" ? TR_LABELS : EN_LABELS;
  const MONTHS = lang === "tr" ? TR_MONTHS : EN_MONTHS;
  
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);

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
    return cust ? cust.full_name : (app.profiles?.full_name || app.custom_fields?.customer_name || "Bilinmeyen Müşteri");
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

    // Fetch tenant working hours
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("working_hours")
      .eq("id", profile.tenant_id)
      .single();
    
    if (tenantData?.working_hours) {
      setWorkingHours(tenantData.working_hours as WorkingHours);
    }

    const [apptRes, svcRes, custRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, services(name, duration, price), profiles!appointments_customer_id_fkey(full_name, phone, avatar_url)")
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
    if (!selectedSlot || !formService) return;
    if (!editingApptId && !formCustomer) return;
    setSaving(true);

    const service = services.find((s) => s.id === formService);
    if (!service) return;

    const start = new Date(selectedSlot.day);
    start.setHours(selectedSlot.hour, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + service.duration);

    if (editingApptId) {
      const { error } = await supabase.from("appointments").update({
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
      const customerName = customers.find((c) => c.id === formCustomer)?.full_name || "";

      const { error } = await supabase.from("appointments").insert({
        tenant_id: tenantId,
        customer_id: formCustomer,
        service_id: formService,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        custom_fields: { customer_name: customerName },
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
        return `${days[0]?.getDate()} ${MONTHS[days[0]?.getMonth()]} ${days[0]?.getFullYear()}`;
      case "weekly": {
        const first = days[0];
        const last = days[days.length - 1];
        return `${first?.getDate()} ${MONTHS[first?.getMonth()]} - ${last?.getDate()} ${MONTHS[last?.getMonth()]} ${last?.getFullYear()}`;
      }
      case "monthly":
        return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  }, [viewMode, days, currentDate, MONTHS]);

  const renderMonthGrid = () => (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-3xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 select-none">
        {LABELS.map((l) => (
          <div
            key={l}
            className="border-r border-slate-200 px-2 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500 last:border-r-0 dark:border-slate-700 dark:text-slate-400"
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
              className={`min-h-[110px] border-b border-r border-slate-200 p-2 transition-colors hover:bg-slate-50/50 dark:border-slate-700 dark:hover:bg-slate-800/40 ${
                isToday ? "bg-indigo-50/40 dark:bg-indigo-900/10" : ""
              }`}
            >
              <div className="flex justify-center mb-1">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold ${
                    isToday
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "text-slate-900 dark:text-slate-200"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                {dayAppts.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAppointment(a)}
                    className="w-full truncate rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-[3px] border-l-indigo-600 px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-indigo-50/50 dark:hover:bg-slate-700/60 shadow-xs transition-colors text-left"
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-5">
      {/* Navigation Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4 select-none">
        
        {/* Sol Taraf: Başlık */}
        <div className="lg:w-1/3 flex justify-start">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {headerLabel}
          </h1>
        </div>

        {/* Orta Kısım: Yön Okları (Sabit Konum) */}
        <div className="lg:w-1/3 flex justify-center">
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 p-1 backdrop-blur-xl border border-slate-200/80 shadow-xs dark:bg-slate-800/60 dark:border-slate-700/80">
            <button
              onClick={() => navigate(-1)}
              className="rounded-xl p-2.5 text-gray-600 hover:bg-white hover:shadow-xs dark:text-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={goToday}
              className="px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-white hover:shadow-xs rounded-xl dark:text-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              {t("calendar.today")}
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-xl p-2.5 text-gray-600 hover:bg-white hover:shadow-xs dark:text-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>

        {/* Sağ Taraf: Sekmeler ve Ekle Butonu */}
        <div className="lg:w-1/3 flex items-center justify-end gap-3">
          <div className="flex rounded-2xl bg-slate-200/60 p-1 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
            {(["today", "weekly", "monthly"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  viewMode === mode
                    ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {mode === "today" ? t("calendar.day") : mode === "weekly" ? t("calendar.week") : t("calendar.month")}
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
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-3xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[800px] lg:min-w-full">
              {/* Day headers */}
              <div
                className="grid border-b border-slate-200 dark:border-slate-700 select-none"
                style={{
                  gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="w-16 shrink-0" />
                {days.map((day, i) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center border-l border-slate-200 py-3.5 dark:border-slate-700 min-w-0 ${
                        isToday ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""
                      }`}
                    >
                      <span className={`text-[11px] font-bold uppercase tracking-widest truncate ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {TR_LABELS[day.getDay()]}
                      </span>
                      <span
                        className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold transition-all shrink-0 ${
                          isToday
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Time slots */}
              <div className="divide-y divide-slate-200 dark:divide-slate-700 relative">
                {(() => {
                  // Calculate hour range from working hours across all displayed days
                  const allDayHours = days.map(day => getDayHours(day, workingHours));
                  const minHour = allDayHours.flat().length > 0 ? Math.min(...allDayHours.flat()) : 9;
                  const maxHour = allDayHours.flat().length > 0 ? Math.max(...allDayHours.flat()) : 21;
                  const displayHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
                  
                  return displayHours.map((hour) => (
                    <div
                      key={hour}
                      className="grid min-h-[92px]"
                      style={{
                        gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <div className="flex w-16 shrink-0 items-start justify-center pt-3 select-none">
                        <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                          {hour.toString().padStart(2, "0")}:00
                        </span>
                      </div>
                      {days.map((day, dayIndex) => {
                        const dayHours = getDayHours(day, workingHours);
                        const isWithinHours = dayHours.includes(hour);
                        const cellId = `${dayIndex}-${hour}`;
                        const realApps = getApptsForSlot(day, hour);
                        const hasContent = realApps.length > 0;
                        const isHighlighted = highlightedCell === cellId;

                        return (
                          <div
                            key={dayIndex}
                            data-cell={cellId}
                            className={`min-w-0 border-l border-slate-200 p-1.5 transition-all dark:border-slate-700 flex flex-col ${
                              isWithinHours 
                                ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer" 
                                : "bg-slate-100/40 dark:bg-slate-800/40 cursor-not-allowed"
                            } ${isSameDay(day, new Date())
                                ? "bg-indigo-50/20 dark:bg-indigo-900/5"
                                : ""
                            } ${isHighlighted ? "ring-2 ring-inset ring-amber-400 bg-amber-50 dark:bg-amber-900/20" : ""}`}
                            onClick={(e) => {
                              if (e.target === e.currentTarget && isWithinHours) {
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
                              className="w-full h-full min-w-0 rounded-xl p-2.5 text-left transition-all hover:shadow-md hover:scale-[0.99] bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 border-l-[5px] border-l-indigo-600 dark:border-l-indigo-500 shadow-xs overflow-hidden flex flex-col justify-between group"
                            >
                              <div className="min-w-0 w-full">
                                <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                                  <p className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight truncate min-w-0">
                                    {realApps[0]?.services?.name || "Randevu"}
                                  </p>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shrink-0 select-none">
                                    {formatTime(realApps[0].start_time)}
                                  </span>
                                </div>
                                <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 leading-tight truncate">
                                  {getCustomerName(realApps[0])}
                                </p>
                              </div>
                              {realApps.length > 1 && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                  +{realApps.length - 1} randevu daha
                                </span>
                              )}
                            </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Create Appointment Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-md bg-black/20 dark:bg-black/40 animate-backdrop-in"
            onClick={() => setSelectedSlot(null)}
          />
          <div className="relative w-full max-w-md rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-3xl dark:border-slate-700/50 dark:bg-slate-900/80 animate-modal-in">
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
              {!editingApptId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    Müşteri Seçimi
                  </label>
                  <CustomSelect
                    value={formCustomer}
                    onChange={(val) => setFormCustomer(val)}
                    options={customers.map((c) => ({
                      value: c.id,
                      label: c.full_name,
                    }))}
                    placeholder="Müşteri seçin..."
                    searchPlaceholder="Müşteri ara..."
                    buttonClassName="w-full flex items-center justify-between rounded-2xl border-0 bg-white/60 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/60 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Hizmet Seçimi
                </label>
                <CustomSelect
                  value={formService}
                  onChange={(val) => setFormService(val)}
                  options={services.map((s) => ({
                    value: s.id,
                    label: s.name,
                    badge: `₺${s.price}`,
                    sublabel: `${s.duration} dk`,
                  }))}
                  placeholder="Hizmet seçin..."
                  searchPlaceholder="Hizmet ara..."
                  buttonClassName="w-full flex items-center justify-between rounded-2xl border-0 bg-white/60 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/60 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all cursor-pointer"
                />
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
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-md shadow-indigo-500/30">
                  {selectedAppointment.custom_fields?.avatar_url || selectedAppointment.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedAppointment.custom_fields?.avatar_url || selectedAppointment.profiles?.avatar_url || undefined}
                      alt={getCustomerName(selectedAppointment)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getCustomerName(selectedAppointment)
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-slate-100 select-text">
                    {getCustomerName(selectedAppointment)}
                  </p>
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 select-text">
                    {selectedAppointment.services?.name || "Hizmet"}
                  </p>
                  {(selectedAppointment.profiles?.phone || selectedAppointment.custom_fields?.phone) && (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 select-text">
                      <Phone size={13} className="shrink-0 text-indigo-500 select-none" />
                      {selectedAppointment.profiles?.phone || selectedAppointment.custom_fields?.phone}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 rounded-3xl bg-white/50 p-4 shadow-inner border border-white/40 dark:bg-slate-800/50 dark:border-slate-700/50">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1 select-none">Tarih</p>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-slate-100 select-text">
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
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1 select-none">Saat</p>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-slate-100 select-text">
                    {formatTime(selectedAppointment.start_time)} -{" "}
                    {formatTime(selectedAppointment.end_time)}
                  </p>
                </div>
              </div>

              {selectedAppointment.custom_fields?.note && (
                <div className="rounded-3xl bg-white/50 p-4 shadow-inner border border-white/40 dark:bg-slate-800/50 dark:border-slate-700/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1 select-none">Açıklama</p>
                  <p className="text-[15px] font-medium text-gray-900 dark:text-slate-100 whitespace-pre-wrap select-text">
                    {selectedAppointment.custom_fields.note}
                  </p>
                </div>
              )}

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
