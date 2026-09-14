"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  CalendarPlus,
  Download,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { format, addDays, isSameDay } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import RequirePhoneModal from "@/components/RequirePhoneModal";

const dayMap: Record<string, number> = {
  pazartesi: 1,
  sali: 2,
  carsamba: 3,
  persembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 0,
};

const defaultWorkingHours: Record<
  string,
  { isOpen: boolean; openTime: string; closeTime: string }
> = {
  pazartesi: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  sali: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  carsamba: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  persembe: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  cuma: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  cumartesi: { isOpen: true, openTime: "10:00", closeTime: "16:00" },
  pazar: { isOpen: false, openTime: "09:00", closeTime: "18:00" },
};

interface ServiceItem {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration?: number;
  duration_minutes?: number;
  price: number;
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  profile_image_url?: string | null;
  working_hours?: Record<string, { isOpen: boolean; openTime: string; closeTime: string }>;
  booking_rules?: { slotDuration?: number; autoApprove?: boolean; notifyEmail?: boolean; notifySms?: boolean; notifyWhatsapp?: boolean };
  phone?: string | null;
  address?: string | null;
}

type TimeFilter = "all" | "morning" | "afternoon" | "evening";

export default function BookPage() {
  const { slug } = useParams();
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantItem | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stepper: 1 = Hizmet, 2 = Tarih & Saat, 3 = Onay & Özet
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [serviceSearch, setServiceSearch] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [note, setNote] = useState("");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const availableDates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)),
    []
  );

  const fetchTenantData = useCallback(async () => {
    setLoading(true);
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .single();

    if (tenantError || !tenantData) {
      setError(lang === "tr" ? "İşletme bulunamadı" : "Business not found");
      setLoading(false);
      return;
    }
    setTenant(tenantData as TenantItem);

    const { data: serviceData } = await supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenantData.id)
      .eq("is_active", true)
      .order("name");

    if (serviceData) {
      setServices(serviceData as ServiceItem[]);
    }

    setLoading(false);
  }, [slug, supabase, lang]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  // Fetch booked slots for the selected date to prevent conflicts
  const fetchBookedSlots = useCallback(async () => {
    if (!tenant || !selectedDate) return;
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: appts } = await supabase
      .from("appointments")
      .select("start_time")
      .eq("tenant_id", tenant.id)
      .neq("status", "cancelled")
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString());

    if (appts) {
      const taken = appts.map((a) => {
        const d = new Date(a.start_time);
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      });
      setBookedSlots(taken);
    }
  }, [tenant, selectedDate, supabase]);

  useEffect(() => {
    fetchBookedSlots();
  }, [fetchBookedSlots]);

  const getServiceDuration = (svc: ServiceItem) => {
    return svc.duration || svc.duration_minutes || 30;
  };

  const getAvailableTimeSlots = (date: Date) => {
    const workingHours = tenant?.working_hours;
    const hoursSource = workingHours || defaultWorkingHours;
    const slotDuration = tenant?.booking_rules?.slotDuration || 30;

    const dayOfWeek = date.getDay();
    const dayName = Object.keys(dayMap).find((key) => dayMap[key] === dayOfWeek);
    if (!dayName) return [];

    const hours = hoursSource[dayName];
    if (!hours || !hours.isOpen) return [];

    const slots: string[] = [];
    const [openH, openM] = hours.openTime.split(":").map(Number);
    const [closeH, closeM] = hours.closeTime.split(":").map(Number);
    const openTotal = openH * 60 + openM;
    const closeTotal = closeH * 60 + closeM;
    const now = new Date();
    const isToday = isSameDay(date, now);
    const nowTotal = now.getHours() * 60 + now.getMinutes();

    for (let m = openTotal; m + slotDuration <= closeTotal; m += slotDuration) {
      // Don't show past slots for today
      if (isToday && m < nowTotal) continue;
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
    }
    return slots;
  };

  const filteredSlots = useMemo(() => {
    const allSlots = getAvailableTimeSlots(selectedDate);
    return allSlots.filter((slot) => {
      const [hourStr, minStr] = slot.split(":");
      const hour = parseInt(hourStr);
      const min = parseInt(minStr);
      const total = hour * 60 + min;
      if (timeFilter === "morning") return total < 12 * 60;
      if (timeFilter === "afternoon") return total >= 12 * 60 && total < 17 * 60;
      if (timeFilter === "evening") return total >= 17 * 60;
      return true;
    });
  }, [selectedDate, timeFilter, tenant]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [services, serviceSearch]);

  const handleBook = async () => {
    if (!tenant || !selectedService || !selectedDate || !selectedTime) return;
    setBookingLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(
        lang === "tr"
          ? "Randevu almak için giriş yapmalısınız."
          : "You must log in to book an appointment."
      );
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .single();

    if (!profile?.phone) {
      setCurrentUserId(user.id);
      setShowPhoneModal(true);
      setBookingLoading(false);
      return;
    }

    const [hour, min] = selectedTime.split(":");
    const start = new Date(selectedDate);
    start.setHours(parseInt(hour), parseInt(min), 0, 0);

    const duration = getServiceDuration(selectedService);
    const end = new Date(start.getTime() + duration * 60000);

    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        service_id: selectedService.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        note,
      }),
    });

    setBookingLoading(false);

    const data = await res.json();
    if (!res.ok || data.error) {
      alert(
        data.error ||
          (lang === "tr"
            ? "Randevu oluşturulurken bir hata oluştu."
            : "An error occurred while booking.")
      );
    } else {
      setBookingSuccess(true);
    }
  };

  // Google Calendar URL Generator
  const getGoogleCalendarUrl = () => {
    if (!selectedService || !selectedDate || !selectedTime || !tenant) return "#";
    const [hour, min] = selectedTime.split(":");
    const start = new Date(selectedDate);
    start.setHours(parseInt(hour), parseInt(min), 0, 0);
    const duration = getServiceDuration(selectedService);
    const end = new Date(start.getTime() + duration * 60000);

    const formatGCal = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      `${selectedService.name} - ${tenant.name}`
    )}&dates=${formatGCal(start)}/${formatGCal(end)}&details=${encodeURIComponent(
      `Randera randevusu: ${selectedService.name} (${tenant.name})`
    )}`;
  };

  // Apple/ICS Calendar Generator
  const downloadIcs = () => {
    if (!selectedService || !selectedDate || !selectedTime || !tenant) return;
    const [hour, min] = selectedTime.split(":");
    const start = new Date(selectedDate);
    start.setHours(parseInt(hour), parseInt(min), 0, 0);
    const duration = getServiceDuration(selectedService);
    const end = new Date(start.getTime() + duration * 60000);

    const formatIcs = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Randera//Appointment Booking//TR",
      "BEGIN:VEVENT",
      `SUMMARY:${selectedService.name} - ${tenant.name}`,
      `DESCRIPTION:Randera Randevusu`,
      `DTSTART:${formatIcs(start)}`,
      `DTEND:${formatIcs(end)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `randevu-${tenant.slug}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-600 h-9 w-9" />
        <p className="text-xs text-gray-400 font-medium">
          {lang === "tr" ? "Randevu takvimi yükleniyor..." : "Loading booking calendar..."}
        </p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-red-500 dark:text-red-400 font-medium gap-2">
        <Info size={28} />
        <span>{error}</span>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-12 px-4 font-sans animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl p-8 sm:p-10 rounded-[36px] shadow-xl border border-white/60 dark:border-slate-800/80 w-full text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-6 ring-8 ring-amber-50 dark:ring-amber-950/30">
            <Clock className="h-10 w-10" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {lang === "tr" ? "İşletme Onayı Bekleniyor" : "Awaiting Business Approval"}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">
            {lang === "tr" ? "Randevu Talebiniz Alındı!" : "Appointment Request Received!"}
          </h2>

          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            <strong className="text-gray-900 dark:text-slate-200">{tenant.name}</strong>{" "}
            {lang === "tr"
              ? "randevu talebinizi inceleyip onaylayacaktır. Durumu 'Randevularım' sayfasından takip edebilirsiniz."
              : "will review and approve your appointment request. You can track status in My Appointments."}
          </p>

          {/* Appointment Ticket / Recap */}
          {selectedService && selectedDate && selectedTime && (
            <div className="bg-gray-50/80 dark:bg-slate-800/50 rounded-2xl p-4 text-left border border-gray-100 dark:border-slate-700/60 mb-6 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>{lang === "tr" ? "Hizmet" : "Service"}:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {selectedService.name}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>{lang === "tr" ? "Tarih ve Saat" : "Date & Time"}:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {format(selectedDate, "dd MMMM yyyy", {
                    locale: lang === "tr" ? tr : enUS,
                  })}{" "}
                  - {selectedTime}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>{lang === "tr" ? "Tutar" : "Price"}:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ₺{selectedService.price}
                </span>
              </div>
            </div>
          )}

          {/* Add to Calendar Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <a
              href={getGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-xs"
            >
              <CalendarPlus size={16} className="text-blue-500" />
              <span>Google Takvim</span>
            </a>

            <button
              onClick={downloadIcs}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-xs"
            >
              <Download size={16} className="text-indigo-500" />
              <span>Apple / .ics İndir</span>
            </button>
          </div>

          <button
            onClick={() => router.push("/my-appointments")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all text-sm"
          >
            {lang === "tr" ? "Randevularımı Görüntüle" : "Go to My Appointments"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-28 sm:pb-12 font-sans px-2">
      {/* Mini Business Banner */}
      <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-sm">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 font-black text-lg sm:text-xl shadow-inner">
          {tenant.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.profile_image_url}
              alt={tenant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            tenant.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight break-words">
              {tenant.name}
            </h1>
            <span className="px-1.5 py-0.5 shrink-0 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
              {lang === "tr" ? "Müsait" : "Open"}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {lang === "tr" ? "Randevu Alma Sihirbazı" : "Booking Wizard"}
          </p>
        </div>
      </div>

      {/* Stepper Wizard Bar */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 p-1 sm:p-1.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 shadow-xs">
        {[
          { num: 1, labelTr: "1. Hizmet", labelTrFull: "1. Hizmet Seçimi", labelEn: "1. Service", labelEnFull: "1. Service" },
          { num: 2, labelTr: "2. Tarih", labelTrFull: "2. Tarih & Saat", labelEn: "2. Date", labelEnFull: "2. Date & Time" },
          { num: 3, labelTr: "3. Onay", labelTrFull: "3. Onay & Not", labelEn: "3. Confirm", labelEnFull: "3. Confirm" },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              onClick={() => {
                if (s.num === 1) setStep(1);
                if (s.num === 2 && selectedService) setStep(2);
                if (s.num === 3 && selectedService && selectedDate && selectedTime) setStep(3);
              }}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : isDone
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "text-gray-400 dark:text-slate-500 hover:text-gray-600"
              }`}
            >
              {isDone ? <Check size={13} className="shrink-0" strokeWidth={2.5} /> : null}
              <span className="sm:hidden">{lang === "tr" ? s.labelTr : s.labelEn}</span>
              <span className="hidden sm:inline">{lang === "tr" ? s.labelTrFull : s.labelEnFull}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: SERVICE SELECTION */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {lang === "tr" ? "Hizmet Seçimi" : "Select Service"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {lang === "tr"
                  ? "Almak istediğiniz hizmeti seçip devam edin."
                  : "Choose the service you would like to book."}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder={lang === "tr" ? "Hizmet ara..." : "Search services..."}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {filteredServices.map((svc) => {
              const isSelected = selectedService?.id === svc.id;
              const duration = getServiceDuration(svc);

              return (
                <button
                  key={svc.id}
                  onClick={() => {
                    setSelectedService(svc);
                    setStep(2);
                  }}
                  className={`group relative flex items-center justify-between p-5 rounded-3xl border transition-all text-left ${
                    isSelected
                      ? "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-md ring-2 ring-indigo-500/20"
                      : "bg-white/80 dark:bg-slate-900/60 border-white/60 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-800/60 hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {svc.name}
                    </h3>
                    {svc.description && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2 max-w-md">
                        {svc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 mt-2">
                      <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        <Clock size={13} className="text-gray-400" />
                        {duration} {lang === "tr" ? "dakika" : "minutes"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="font-black text-xl text-indigo-600 dark:text-indigo-400">
                      ₺{svc.price}
                    </span>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white"
                      }`}
                    >
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredServices.length === 0 && (
              <div className="p-12 text-center rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 text-gray-400 text-sm">
                {lang === "tr" ? "Eşleşen hizmet bulunamadı." : "No services found."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: DATE & TIME SELECTION */}
      {step === 2 && selectedService && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {lang === "tr" ? "Tarih ve Saat Seçin" : "Select Date & Time"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {selectedService.name} • ₺{selectedService.price} (
                {getServiceDuration(selectedService)} {lang === "tr" ? "dk" : "min"})
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {lang === "tr" ? "Hizmeti Değiştir" : "Change Service"}
            </button>
          </div>

          {/* 14-Day Horizontal Calendar Scroll */}
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl p-5 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              {lang === "tr" ? "1. Gün Seçin" : "1. Select Day"}
            </h3>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {availableDates.map((date, i) => {
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const locale = lang === "tr" ? tr : enUS;
                const isToday = isSameDay(date, new Date());
                const isTomorrow = isSameDay(date, addDays(new Date(), 1));

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime(null);
                    }}
                    className={`flex flex-col items-center min-w-[74px] p-3 rounded-2xl border transition-all shrink-0 ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.03]"
                        : "bg-white/80 dark:bg-slate-800/70 border-gray-200/70 dark:border-slate-700/60 text-gray-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:-translate-y-0.5"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isSelected ? "text-indigo-100" : "text-gray-400 dark:text-slate-400"
                      }`}
                    >
                      {isToday
                        ? lang === "tr"
                          ? "Bugün"
                          : "Today"
                        : isTomorrow
                        ? lang === "tr"
                          ? "Yarın"
                          : "Tmrw"
                        : format(date, "EEE", { locale })}
                    </span>
                    <span className="text-2xl font-black mt-1 leading-tight">
                      {format(date, "d")}
                    </span>
                    <span
                      className={`text-[10px] font-medium mt-0.5 ${
                        isSelected ? "text-indigo-100" : "text-gray-400"
                      }`}
                    >
                      {format(date, "MMM", { locale })}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Time of Day Filters */}
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  {lang === "tr" ? "2. Saat Seçin" : "2. Select Time"}
                </h3>

                {/* Time filter pills */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 text-[11px] font-bold">
                  {(
                    [
                      { id: "all", tr: "Tümü", en: "All" },
                      { id: "morning", tr: "Sabah", en: "Morning" },
                      { id: "afternoon", tr: "Öğle", en: "Afternoon" },
                      { id: "evening", tr: "Akşam", en: "Evening" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setTimeFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        timeFilter === f.id
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
                      }`}
                    >
                      {lang === "tr" ? f.tr : f.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {filteredSlots.length > 0 ? (
                  filteredSlots.map((time) => {
                    const isBooked = bookedSlots.includes(time);
                    const isSelected = selectedTime === time;

                    return (
                      <button
                        key={time}
                        disabled={isBooked}
                        onClick={() => {
                          setSelectedTime(time);
                          setTimeout(() => {
                            setStep(3);
                          }, 220);
                        }}
                        className={`py-3 rounded-2xl text-xs sm:text-sm font-black border transition-all ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-[1.04]"
                            : isBooked
                            ? "bg-gray-100 dark:bg-slate-800/40 border-transparent text-gray-300 dark:text-slate-600 cursor-not-allowed line-through"
                            : "bg-white/80 dark:bg-slate-800/80 border-gray-200/70 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 active:scale-95"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 text-center text-xs text-gray-400 bg-gray-50 dark:bg-slate-800/40 rounded-2xl">
                    {lang === "tr"
                      ? "Bu zaman diliminde müsait saat bulunmuyor."
                      : "No available slots in this time period."}
                  </div>
                )}
              </div>

              {/* Step 2 Bottom Navigation & Continue Action Bar */}
              <div className="mt-8 pt-5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors w-fit"
                >
                  <ChevronLeft size={16} />
                  <span>{lang === "tr" ? "Hizmet Seçimine Dön" : "Back to Services"}</span>
                </button>

                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => setStep(3)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-500/25 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  <span>
                    {selectedTime
                      ? lang === "tr"
                        ? `Onay ve Not Adımına Geç (${selectedTime})`
                        : `Proceed to Confirm (${selectedTime})`
                      : lang === "tr"
                      ? "Lütfen Bir Saat Seçin"
                      : "Please Select a Time"}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRMATION & NOTES */}
      {step === 3 && selectedService && selectedDate && selectedTime && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {lang === "tr" ? "Randevu Özeti ve Onay" : "Appointment Summary"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {lang === "tr"
                ? "Lütfen bilgilerinizi kontrol edin ve randevuyu onaylayın."
                : "Please review your details and confirm booking."}
            </p>
          </div>

          {/* Boarding-pass Style Summary Card */}
          <div className="relative overflow-hidden rounded-[32px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl border border-white/60 dark:border-slate-800/80 p-6 sm:p-8 shadow-lg">
            <div className="flex items-center justify-between pb-6 border-b border-dashed border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {tenant.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {lang === "tr" ? "Doğrulanmış İşletme" : "Verified Business"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block font-medium">
                  {lang === "tr" ? "Toplam Ücret" : "Total Price"}
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₺{selectedService.price}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-6 border-b border-dashed border-gray-200 dark:border-slate-800 text-xs sm:text-sm">
              <div>
                <span className="text-gray-400 block mb-1">
                  {lang === "tr" ? "Seçilen Hizmet" : "Selected Service"}
                </span>
                <p className="font-bold text-gray-800 dark:text-slate-200">
                  {selectedService.name}
                </p>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  {getServiceDuration(selectedService)} {lang === "tr" ? "dakika" : "minutes"}
                </span>
              </div>

              <div>
                <span className="text-gray-400 block mb-1">
                  {lang === "tr" ? "Tarih ve Saat" : "Date & Time"}
                </span>
                <p className="font-bold text-gray-800 dark:text-slate-200">
                  {format(selectedDate, "dd MMMM yyyy, EEEE", {
                    locale: lang === "tr" ? tr : enUS,
                  })}
                </p>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  {selectedTime}
                </span>
              </div>
            </div>

            {/* Note input */}
            <div className="pt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2">
                {lang === "tr"
                  ? "İşletmeye İletmek İstediğiniz Not (Opsiyonel)"
                  : "Note to Business (Optional)"}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  lang === "tr"
                    ? "Örn: İlk defa geleceğim, özel bir talebim var..."
                    : "Any special requests or instructions..."
                }
                rows={3}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-xs sm:text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1 px-4 py-3.5 rounded-2xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft size={16} />
                <span>{lang === "tr" ? "Geri" : "Back"}</span>
              </button>

              <button
                type="button"
                disabled={bookingLoading}
                onClick={handleBook}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50"
              >
                {bookingLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <CalendarIcon size={18} />
                )}
                <span>
                  {bookingLoading
                    ? lang === "tr"
                      ? "Randevu Oluşturuluyor..."
                      : "Booking..."
                    : lang === "tr"
                    ? "Randevuyu Onayla"
                    : "Confirm Appointment"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE STICKY BOTTOM BAR */}
      {selectedService && step < 3 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-t border-gray-200/60 dark:border-slate-800/80 shadow-2xl sm:hidden flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 truncate max-w-[150px]">
              {selectedService.name}
            </p>
            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
              ₺{selectedService.price}
              {selectedTime && (
                <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 ml-2">
                  • {selectedTime}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => {
              if (step === 1) setStep(2);
              else if (step === 2 && selectedTime) setStep(3);
            }}
            disabled={step === 2 && !selectedTime}
            className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            <span>
              {step === 1
                ? lang === "tr"
                  ? "Tarih Seç"
                  : "Pick Date"
                : lang === "tr"
                ? "Onaya Geç"
                : "Proceed"}
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {currentUserId && (
        <RequirePhoneModal
          isOpen={showPhoneModal}
          userId={currentUserId}
          onSuccess={() => {
            setShowPhoneModal(false);
            handleBook();
          }}
        />
      )}
    </div>
  );
}

