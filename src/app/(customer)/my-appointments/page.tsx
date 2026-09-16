"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO, isAfter } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { useLanguage } from "@/context/LanguageContext";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Building2, 
  Phone, 
  CalendarPlus, 
  Download, 
  XCircle, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Compass, 
  Sparkles, 
  AlertTriangle, 
  ExternalLink,
  RotateCcw,
  Undo2,
  Loader2,
  ChevronDown,
  Star
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewModal from "@/components/ReviewModal";

interface Appointment {
  id: string;
  customer_id: string | null;
  tenant_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  custom_fields?: {
    customer_name?: string;
    phone?: string;
    note?: string;
    cancel_requested?: boolean;
    cancel_reason?: string;
    cancel_requested_at?: string;
    review?: {
      rating: number;
      comment?: string;
      created_at?: string;
    };
  };
  services?: {
    name: string;
    duration?: number;
    duration_minutes?: number;
    price: number;
  };
  tenants?: {
    name: string;
    address?: string;
    phone?: string;
    slug?: string;
    booking_rules?: {
      cancelDeadlineHours?: number;
    };
  };
}

export default function MyAppointmentsPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();
  const locale = lang === "tr" ? tr : enUS;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [withdrawingAppt, setWithdrawingAppt] = useState<Appointment | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [reviewAppt, setReviewAppt] = useState<Appointment | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleReviewSuccess = (review: { rating: number; comment: string }) => {
    if (!reviewAppt) return;
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === reviewAppt.id
          ? {
              ...a,
              status: "completed",
              custom_fields: {
                ...a.custom_fields,
                review: {
                  ...review,
                  created_at: new Date().toISOString(),
                },
              },
            }
          : a
      )
    );
    setNotification({
      message: lang === "tr" ? "Değerlendirmeniz başarıyla kaydedildi!" : "Review submitted successfully!",
      type: "success",
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // İptal modu: süre dolmuşsa direkt iptal, dolmuşsa işletmeye istek gönderilir
  const getCancelMode = (appt: Appointment): "direct" | "request" => {
    const deadline = appt.tenants?.booking_rules?.cancelDeadlineHours ?? 24;
    const hoursLeft = (new Date(appt.start_time).getTime() - Date.now()) / 3600000;
    return hoursLeft >= deadline ? "direct" : "request";
  };

  const getCancelDeadline = (appt: Appointment): number => {
    return appt.tenants?.booking_rules?.cancelDeadlineHours ?? 24;
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: appts, error } = await supabase
      .from("appointments")
      .select(`
        *,
        services (name, duration, price),
        tenants (name, address, phone, slug, booking_rules)
      `)
      .eq("customer_id", user.id)
      .order("start_time", { ascending: false });

    if (error) {
      console.error("Randevular yüklenemedi:", error);
    }

    if (appts && !error) {
      setAppointments(appts as unknown as Appointment[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Randevu İptal İşlemi
  const handleCancelAppointment = async () => {
    if (!cancellingAppt) return;
    setCancelLoading(true);

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", cancellingAppt.id);

      if (error) throw error;

      // State'i güncelle
      setAppointments((prev) =>
        prev.map((a) => (a.id === cancellingAppt.id ? { ...a, status: "cancelled" } : a))
      );

      setNotification({
        message: lang === "tr" ? "Randevunuz başarıyla iptal edildi." : "Appointment cancelled successfully.",
        type: "success",
      });
      setCancellingAppt(null);

      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        message: err.message || (lang === "tr" ? "İptal sırasında bir hata oluştu." : "Failed to cancel appointment."),
        type: "error",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  // İptal İsteği Gönderme (süre dolmuşsa işletmeye iletilir)
  const handleSendCancelRequest = async () => {
    if (!cancellingAppt) return;
    setCancelLoading(true);

    try {
      const res = await fetch("/api/appointments/cancel-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: cancellingAppt.id, reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "İstek gönderilemedi.");

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === cancellingAppt.id
            ? {
                ...a,
                custom_fields: {
                  ...a.custom_fields,
                  cancel_requested: true,
                  cancel_reason: cancelReason.trim(),
                  cancel_requested_at: new Date().toISOString(),
                },
              }
            : a
        )
      );

      setNotification({
        message: lang === "tr" ? "İptal isteğiniz işletmeye iletildi." : "Cancellation request sent to the business.",
        type: "success",
      });
      setCancellingAppt(null);
      setCancelReason("");

      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        message: err.message || (lang === "tr" ? "İstek gönderilirken bir hata oluştu." : "Failed to send request."),
        type: "error",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  // İptal İsteğini Geri Çekme (müşteri vazgeçti)
  const handleWithdrawCancelRequest = async () => {
    if (!withdrawingAppt) return;
    setWithdrawLoading(true);

    try {
      const res = await fetch(`/api/appointments/cancel-request?appointment_id=${withdrawingAppt.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "İstek geri çekilemedi.");

      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id !== withdrawingAppt.id) return a;
          const { cancel_requested, cancel_reason, cancel_requested_at, ...rest } = a.custom_fields || {};
          return { ...a, custom_fields: rest };
        })
      );

      setNotification({
        message: lang === "tr" ? "İptal isteğiniz geri çekildi. Randevunuz geçerli." : "Request withdrawn. Your appointment is still valid.",
        type: "success",
      });
      setWithdrawingAppt(null);

      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        message: err.message || (lang === "tr" ? "İşlem sırasında bir hata oluştu." : "Something went wrong."),
        type: "error",
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Google Calendar URL üretici
  const createGoogleCalendarUrl = (appt: Appointment) => {
    const title = encodeURIComponent(`${appt.services?.name || "Randevu"} - ${appt.tenants?.name || "Randera"}`);
    const location = encodeURIComponent(appt.tenants?.address || "");
    const details = encodeURIComponent(
      `Randera üzerinden oluşturulmuş randevu.\nİşletme: ${appt.tenants?.name || ""}\nTelefon: ${appt.tenants?.phone || ""}`
    );

    const formatToCal = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const startCal = formatToCal(new Date(appt.start_time));
    const duration = appt.services?.duration_minutes || appt.services?.duration || 45;
    const endCal = formatToCal(
      appt.end_time
        ? new Date(appt.end_time)
        : new Date(new Date(appt.start_time).getTime() + duration * 60000)
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startCal}/${endCal}&details=${details}&location=${location}`;
  };

  // Apple / Outlook .ics Takvim Dosyası İndirici
  const downloadIcsFile = (appt: Appointment) => {
    const formatToIcs = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const startIcs = formatToIcs(new Date(appt.start_time));
    const duration = appt.services?.duration_minutes || appt.services?.duration || 45;
    const endIcs = formatToIcs(
      appt.end_time
        ? new Date(appt.end_time)
        : new Date(new Date(appt.start_time).getTime() + duration * 60000)
    );
    const title = `${appt.services?.name || "Randevu"} - ${appt.tenants?.name || "Randera"}`;
    const location = appt.tenants?.address || "";
    const description = `Randera Randevusu. İşletme: ${appt.tenants?.name || ""}`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Randera//Appointment Booking//TR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${appt.id}@randera.com`,
      `DTSTAMP:${startIcs}`,
      `DTSTART:${startIcs}`,
      `DTEND:${endIcs}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `randevu-${appt.id.slice(0, 8)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Kalan Süre Metni (Countdown)
  const getCountdownText = (startTime: string) => {
    const target = new Date(startTime);
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return lang === "tr" ? "Randevu vakti geldi" : "Appointment time";

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      return lang === "tr" ? `${diffDays} gün kaldı` : `In ${diffDays} days`;
    }
    if (diffDays === 1) {
      return lang === "tr" ? "Yarın" : "Tomorrow";
    }
    if (diffHours >= 1) {
      return lang === "tr" ? `${diffHours} saat kaldı` : `In ${diffHours} hours`;
    }
    return lang === "tr" ? `${diffMins} dakika kaldı` : `In ${diffMins} minutes`;
  };

  // Yaklaşan ve Geçmiş Gruplaması
  const now = new Date();
  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((a) => isAfter(parseISO(a.start_time), now) && a.status !== "cancelled")
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [appointments]);

  const pastAppointments = useMemo(() => {
    return appointments
      .filter((a) => !isAfter(parseISO(a.start_time), now) || a.status === "cancelled")
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [appointments]);

  // Yaklaşanları durumlarına göre ayır: Onaylanan vs Onay Bekleyen
  const confirmedUpcoming = useMemo(() => {
    return upcomingAppointments.filter((a) => a.status !== "pending");
  }, [upcomingAppointments]);

  const pendingUpcoming = useMemo(() => {
    return upcomingAppointments.filter((a) => a.status === "pending");
  }, [upcomingAppointments]);

  const nearestUpcoming = upcomingAppointments[0] || null;

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
          {lang === "tr" ? "Randevularınız yükleniyor..." : "Loading your appointments..."}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      {/* Toast Bildirimi */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold shadow-lg animate-in slide-in-from-top-2 duration-200 ${
            notification.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-rose-500 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-80">
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            {lang === "tr" ? "Randevularım" : "My Appointments"}
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
              {upcomingAppointments.length} {lang === "tr" ? "Yaklaşan" : "Upcoming"}
            </span>
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
            {lang === "tr"
              ? "Tüm randevularınızı görüntüleyin, takviminize kaydedin veya kolayca yönetin."
              : "Track all your appointments, add to calendar, or manage booking status."}
          </p>
        </div>

        <Link
          href="/discover"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Compass size={16} />
          {lang === "tr" ? "Yeni Randevu Keşfet" : "Explore Businesses"}
        </Link>
      </div>

      {/* Hero Spotlight: En Yakın Randevu Kartı (Varsa) */}
      {nearestUpcoming && (
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[32px] px-4 py-4 sm:p-6 md:p-8 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-[0_12px_40px_rgba(79,70,229,0.25)]">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-6">
            <div className="space-y-1 sm:space-y-2">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] sm:text-xs font-black uppercase tracking-wider text-indigo-100">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>{lang === "tr" ? "Sıradaki Randevunuz" : "Next Upcoming Appointment"} • {getCountdownText(nearestUpcoming.start_time)}</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
                {nearestUpcoming.services?.name || (lang === "tr" ? "Hizmet" : "Service")}
              </h2>
              <p className="text-indigo-100 font-medium flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <Building2 size={15} className="shrink-0" />
                <span>{nearestUpcoming.tenants?.name || (lang === "tr" ? "İşletme" : "Business")}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-left sm:text-right">
                <div>
                  <div className="text-[11px] sm:text-xs font-bold text-indigo-200">
                    {format(parseISO(nearestUpcoming.start_time), "EEEE", { locale })}
                  </div>
                  <div className="text-base sm:text-xl font-black">
                    {format(parseISO(nearestUpcoming.start_time), "d MMMM yyyy", { locale })}
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center justify-end gap-1 sm:mt-0.5">
                  <Clock size={13} className="shrink-0" />
                  <span>{format(parseISO(nearestUpcoming.start_time), "HH:mm")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 w-full sm:w-auto">
                <a
                  href={createGoogleCalendarUrl(nearestUpcoming)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs shadow-md transition-all active:scale-95 text-center"
                >
                  <CalendarPlus size={14} className="shrink-0" />
                  <span className="truncate">Google Takvim</span>
                </a>
                <button
                  onClick={() => downloadIcsFile(nearestUpcoming)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition-all active:scale-95 text-center"
                >
                  <Download size={14} className="shrink-0" />
                  <span className="truncate">Apple Takvim</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-slate-800/70 shadow-sm">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all flex items-center gap-2 ${
              activeTab === "upcoming"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Calendar size={15} />
            {lang === "tr" ? "Yaklaşan Randevular" : "Upcoming"} ({upcomingAppointments.length})
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all flex items-center gap-2 ${
              activeTab === "past"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Clock size={15} />
            {lang === "tr" ? "Geçmiş & İptaller" : "Past & Cancelled"} ({pastAppointments.length})
          </button>
        </div>
      </div>

      {/* Randevu Kartları Listesi */}
      {activeTab === "upcoming" ? (
        upcomingAppointments.length === 0 ? (
          <div className="py-16 text-center rounded-[32px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-dashed border-gray-300 dark:border-slate-800 p-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {lang === "tr" ? "Yaklaşan Randevunuz Yok" : "No Upcoming Appointments"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
              {lang === "tr"
                ? "Randera üzerinden kayıtlı kuaför, klinik, güzellik ve bakım işletmelerinden dilediğiniz gibi randevu oluşturabilirsiniz."
                : "Explore top-rated businesses and book appointments seamlessly on Randera."}
            </p>
            <Link
              href="/discover"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
            >
              <Compass size={15} />
              {lang === "tr" ? "Hemen İşletme Bul" : "Find Businesses Now"}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Onaylanan Randevular */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h2 className="text-base md:text-lg font-extrabold text-gray-900 dark:text-white">
                  {lang === "tr" ? "Onaylanan Randevular" : "Confirmed Appointments"}
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                  {confirmedUpcoming.length}
                </span>
              </div>
              {confirmedUpcoming.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500 px-1 py-2">
                  {lang === "tr" ? "Onaylanmış randevunuz yok." : "No confirmed appointments."}
                </p>
              ) : (
                <div className="space-y-4">
                  {confirmedUpcoming.map((appt) => (
                    <BoardingPassCard
                      key={appt.id}
                      appt={appt}
                      isPast={false}
                      lang={lang}
                      locale={locale}
                      cancelMode={getCancelMode(appt)}
                      onDownloadIcs={downloadIcsFile}
                      onGoogleCal={createGoogleCalendarUrl}
                      onCancelPrompt={() => setCancellingAppt(appt)}
                      onWithdrawPrompt={() => setWithdrawingAppt(appt)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Onay Bekleyen Randevular */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-base md:text-lg font-extrabold text-gray-900 dark:text-white">
                  {lang === "tr" ? "Onay Bekleyen Randevular" : "Pending Approval"}
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200/50 dark:border-amber-500/20">
                  {pendingUpcoming.length}
                </span>
              </div>
              {pendingUpcoming.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500 px-1 py-2">
                  {lang === "tr" ? "Onay bekleyen randevunuz yok." : "No pending appointments."}
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingUpcoming.map((appt) => (
                    <BoardingPassCard
                      key={appt.id}
                      appt={appt}
                      isPast={false}
                      lang={lang}
                      locale={locale}
                      cancelMode={getCancelMode(appt)}
                      onDownloadIcs={downloadIcsFile}
                      onGoogleCal={createGoogleCalendarUrl}
                      onCancelPrompt={() => setCancellingAppt(appt)}
                      onWithdrawPrompt={() => setWithdrawingAppt(appt)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        pastAppointments.length === 0 ? (
          <div className="py-16 text-center rounded-[32px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-gray-200 dark:border-slate-800 p-8">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {lang === "tr" ? "Geçmiş Randevunuz Bulunmuyor" : "No Past Appointments"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {lang === "tr" ? "Daha önce tamamlanan bir randevunuz bulunmuyor." : "You have no completed or cancelled appointments yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pastAppointments.map((appt) => (
              <BoardingPassCard
                key={appt.id}
                appt={appt}
                isPast={true}
                lang={lang}
                locale={locale}
                onDownloadIcs={downloadIcsFile}
                onGoogleCal={createGoogleCalendarUrl}
                onCancelPrompt={() => {}}
                onReviewPrompt={() => setReviewAppt(appt)}
              />
            ))}
          </div>
        )
      )}

      {/* İptal Onay Modalı */}
      {cancellingAppt && (() => {
        const isRequest = getCancelMode(cancellingAppt) === "request";
        return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-white/60 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isRequest
                    ? lang === "tr" ? "İptal İsteği Gönder" : "Request Cancellation"
                    : lang === "tr" ? "Randevuyu İptal Et" : "Cancel Appointment"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {isRequest
                    ? lang === "tr"
                      ? `Randevuya ${getCancelDeadline(cancellingAppt)} saatten az kaldığı için isteğiniz işletmenin onayına gönderilir.`
                      : `Less than ${getCancelDeadline(cancellingAppt)} hours left, so your request will be sent for business approval.`
                    : lang === "tr" ? "Bu işlem geri alınamaz." : "This action cannot be undone."}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60 space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
              <div className="font-bold text-gray-900 dark:text-white text-sm">
                {cancellingAppt.services?.name}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                <Building2 size={13} />
                {cancellingAppt.tenants?.name}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                <Calendar size={13} />
                {format(parseISO(cancellingAppt.start_time), "d MMMM yyyy, HH:mm", { locale })}
              </div>
            </div>

            {isRequest ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  {lang === "tr" ? "İptal Sebebiniz (opsiyonel)" : "Reason (optional)"}
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={lang === "tr" ? "İşletmeye iletilecek kısa bir açıklama yazın..." : "Write a short note for the business..."}
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
                />
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {lang === "tr"
                  ? "Randevuyu iptal ettiğinizde ilgili saat işletmenin takviminde yeniden diğer müşterilerin erişimine açılacaktır."
                  : "Cancelling will release this time slot for other customers."}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setCancellingAppt(null); setCancelReason(""); }}
                disabled={cancelLoading}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                {lang === "tr" ? "Vazgeç" : "Keep Appointment"}
              </button>
              <button
                type="button"
                onClick={isRequest ? handleSendCancelRequest : handleCancelAppointment}
                disabled={cancelLoading}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                {cancelLoading && <Loader2 size={14} className="animate-spin" />}
                {isRequest
                  ? lang === "tr" ? "İsteği Gönder" : "Send Request"
                  : lang === "tr" ? "Evet, İptal Et" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>,
        document.body
        );
      })()}

      {/* Talebi Geri Çek Onay Modalı */}
      {withdrawingAppt &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-2xl border border-white/60 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Undo2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {lang === "tr" ? "Talebi Geri Çek" : "Withdraw Request"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {withdrawingAppt.services?.name} • {withdrawingAppt.tenants?.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {lang === "tr"
                  ? "İptal isteğiniz geri çekilecek ve randevunuz eskisi gibi geçerli olmaya devam edecek."
                  : "Your cancellation request will be withdrawn and your appointment will remain valid."}
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setWithdrawingAppt(null)}
                  disabled={withdrawLoading}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {lang === "tr" ? "Vazgeç" : "Keep Request"}
                </button>
                <button
                  type="button"
                  onClick={handleWithdrawCancelRequest}
                  disabled={withdrawLoading}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {withdrawLoading && <Loader2 size={14} className="animate-spin" />}
                  {lang === "tr" ? "Evet, Geri Çek" : "Yes, Withdraw"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Değerlendirme Modalı */}
      {reviewAppt && (
        <ReviewModal
          isOpen={Boolean(reviewAppt)}
          onClose={() => setReviewAppt(null)}
          appointmentId={reviewAppt.id}
          businessName={reviewAppt.tenants?.name || "İşletme"}
          serviceName={reviewAppt.services?.name}
          initialRating={reviewAppt.custom_fields?.review?.rating || 5}
          initialComment={reviewAppt.custom_fields?.review?.comment || ""}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}

// Boarding-Pass / Ticket Bileti Bileşeni
function BoardingPassCard({
  appt,
  isPast,
  lang,
  locale,
  cancelMode = "direct",
  onDownloadIcs,
  onGoogleCal,
  onCancelPrompt,
  onWithdrawPrompt,
  onReviewPrompt,
}: {
  appt: Appointment;
  isPast: boolean;
  lang: string;
  locale: any;
  cancelMode?: "direct" | "request";
  onDownloadIcs: (a: Appointment) => void;
  onGoogleCal: (a: Appointment) => string;
  onCancelPrompt: () => void;
  onWithdrawPrompt?: () => void;
  onReviewPrompt?: () => void;
}) {
  const isCancelled = appt.status === "cancelled";
  const isPending = appt.status === "pending";
  const isCompleted = appt.status === "completed" || (isPast && !isCancelled && !isPending);
  const cancelRequested = appt.custom_fields?.cancel_requested === true;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${appt.tenants?.name || ""} ${appt.tenants?.address || ""}`
  )}`;

  const bookingSlug = appt.tenants?.slug || appt.tenant_id;
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);
  const calendarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(event.target as Node)) {
        setCalendarMenuOpen(false);
      }
    }
    if (calendarMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [calendarMenuOpen]);

  return (
    <div
      className={`group relative overflow-hidden rounded-[28px] border transition-all duration-300 ${
        isCancelled
          ? "bg-white/40 dark:bg-slate-900/50 border-gray-200/90 dark:border-rose-500/35 dark:shadow-[0_0_20px_-3px_rgba(244,63,94,0.15)] opacity-80 hover:dark:border-rose-500/55"
          : isPending
          ? "bg-amber-50/20 dark:bg-slate-900/70 border-amber-200/80 dark:border-amber-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_0_20px_-3px_rgba(245,158,11,0.18)] hover:dark:border-amber-500/60"
          : isPast
          ? "bg-white/60 dark:bg-slate-900/50 border-gray-200/80 dark:border-slate-800/80 shadow-xs"
          : "bg-white/80 dark:bg-slate-900/70 border-white/60 dark:border-emerald-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_0_20px_-3px_rgba(16,185,129,0.18)] hover:border-indigo-300 dark:hover:border-emerald-500/60"
      }`}
    >
      <div className="flex flex-col lg:flex-row items-stretch">
        {/* Sol Bilet Başlığı: Tarih & Saat Dilimi */}
        <div
          className={`flex lg:flex-col items-center justify-between lg:justify-center p-5 lg:w-44 shrink-0 text-center border-b lg:border-b-0 lg:border-r ${
            isCancelled
              ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/20 text-rose-700 dark:text-rose-400"
              : isPast
              ? "bg-gray-50/50 dark:bg-slate-800/30 border-gray-100 dark:border-slate-800 text-gray-600 dark:text-slate-400"
              : isPending
              ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-100/60 dark:border-amber-900/20 text-amber-700 dark:text-amber-400"
              : "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100/60 dark:border-indigo-900/20 text-indigo-700 dark:text-indigo-400"
          }`}
        >
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest block">
              {format(parseISO(appt.start_time), "MMMM", { locale })}
            </span>
            <span className="text-3xl md:text-4xl font-black tracking-tight block my-0.5">
              {format(parseISO(appt.start_time), "d")}
            </span>
            <span className="text-xs font-bold block">
              {format(parseISO(appt.start_time), "EEEE", { locale })}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-xs text-xs font-black lg:mt-3">
            <Clock size={13} />
            {format(parseISO(appt.start_time), "HH:mm")}
          </div>
        </div>

        {/* Orta Bilet Gövdesi: İşletme, Hizmet, Konum */}
        <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              {/* İşletme Adı */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-slate-400">
                  <Building2 size={14} className="text-indigo-500" />
                  {appt.tenants?.name || (lang === "tr" ? "İşletme" : "Business")}
                </span>
                {bookingSlug && (
                  <Link
                    href={`/b/${bookingSlug}`}
                    scroll={false}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    {lang === "tr" ? "Profili Gör" : "Profile"}
                    <ExternalLink size={11} />
                  </Link>
                )}
              </div>

              {/* Durum Rozeti */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  isCancelled
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/20"
                    : isCompleted
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20"
                    : isPending
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200/50 dark:border-amber-500/20"
                    : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20"
                }`}
              >
                {isPending && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                {!isCancelled && !isPast && !isPending && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                {isCancelled
                  ? lang === "tr"
                    ? "İptal Edildi"
                    : "Cancelled"
                  : isCompleted
                  ? lang === "tr"
                    ? "Tamamlandı"
                    : "Completed"
                  : isPending
                  ? lang === "tr"
                    ? "İşletme Onayı Bekliyor"
                    : "Pending Approval"
                  : lang === "tr"
                  ? "Onaylandı"
                  : "Confirmed"}
              </div>
            </div>

            {/* Hizmet Adı & Fiyat */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1">
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                {appt.services?.name || (lang === "tr" ? "Randevu Hizmeti" : "Service")}
              </h3>
              {appt.services?.price != null && (
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ₺{appt.services.price.toLocaleString("tr-TR")}
                </div>
              )}
            </div>

            {/* Konum ve Telefon */}
            <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs text-gray-600 dark:text-slate-300">
              {appt.tenants?.address ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/link"
                >
                  <MapPin size={14} className="text-gray-400 group-hover/link:text-indigo-500 shrink-0" />
                  <span className="truncate">{appt.tenants.address}</span>
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-gray-400">
                  <MapPin size={14} className="shrink-0" />
                  {lang === "tr" ? "Adres belirtilmemiş" : "No address specified"}
                </span>
              )}

              {appt.tenants?.phone && (
                <a
                  href={`tel:${appt.tenants.phone}`}
                  className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <span>{appt.tenants.phone}</span>
                </a>
              )}
            </div>

            {/* Randevu Notu */}
            {appt.custom_fields?.note && (
              <div className="mt-3 text-xs text-gray-500 dark:text-slate-400 bg-gray-50/80 dark:bg-slate-800/40 p-2.5 rounded-xl italic border border-gray-100 dark:border-slate-800">
                &ldquo;{appt.custom_fields.note}&rdquo;
              </div>
            )}
          </div>

          {/* Sağ Alt: Aksiyon Butonları (Yaklaşan randevularda zengin aksiyonlar) */}
          {!isPast && !isCancelled && (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
              {/* Sol: Şık Takvime Ekle Açılır Menüsü */}
              <div className="relative" ref={calendarMenuRef}>
                <button
                  type="button"
                  onClick={() => setCalendarMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs transition-all active:scale-95 border border-transparent dark:border-slate-700/50"
                >
                  <CalendarPlus size={13} className="text-indigo-500" />
                  <span>{lang === "tr" ? "Takvime Ekle" : "Add to Calendar"}</span>
                  <ChevronDown
                    size={12}
                    className={`text-gray-400 transition-transform duration-200 ${
                      calendarMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {calendarMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-48 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-slate-800 shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                    <a
                      href={onGoogleCal(appt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setCalendarMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <CalendarPlus size={14} className="text-blue-500 shrink-0" />
                      <span>Google Takvim</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        onDownloadIcs(appt);
                        setCalendarMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
                    >
                      <Download size={14} className="text-indigo-500 shrink-0" />
                      <span>Apple Takvim (.ics)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Sağ: Yol Tarifi ve İptal / Vazgeç Butonları */}
              <div className="flex items-center gap-2 ml-auto">
                {appt.tenants?.address && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 font-bold text-xs transition-colors shrink-0"
                  >
                    <MapPin size={13} />
                    <span>{lang === "tr" ? "Yol Tarifi" : "Directions"}</span>
                  </a>
                )}

                {cancelRequested ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 font-bold text-[11px] sm:text-xs border border-amber-200/50 dark:border-amber-500/20">
                      <Clock size={12} />
                      <span>{lang === "tr" ? "İstek İletildi" : "Request Sent"}</span>
                    </span>
                    <button
                      onClick={onWithdrawPrompt}
                      title={lang === "tr" ? "Talebi Geri Çek" : "Withdraw Request"}
                      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                    >
                      <Undo2 size={13} />
                      <span>{lang === "tr" ? "Vazgeç" : "Withdraw"}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onCancelPrompt}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 font-bold text-xs transition-colors shrink-0"
                  >
                    <XCircle size={13} />
                    <span>
                      {cancelMode === "request"
                        ? lang === "tr"
                          ? "İptal İsteği"
                          : "Request Cancel"
                        : lang === "tr"
                        ? "İptal Et"
                        : "Cancel"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Geçmiş / İptal randevularda tekrar randevu al kısayolu & Değerlendirme Butonu */}
          {(isPast || isCancelled) && (
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
              {!isCancelled && onReviewPrompt ? (
                <button
                  type="button"
                  onClick={onReviewPrompt}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs ${
                    appt.custom_fields?.review
                      ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                      : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30"
                  }`}
                >
                  <Star
                    size={13}
                    className={appt.custom_fields?.review ? "fill-amber-400 text-amber-400" : "text-indigo-500"}
                  />
                  <span>
                    {appt.custom_fields?.review
                      ? `Değerlendirildi (★ ${appt.custom_fields.review.rating})`
                      : (lang === "tr" ? "Değerlendir & Yorum Yap" : "Rate & Review")}
                  </span>
                </button>
              ) : <div />}

              {bookingSlug && (
                <Link
                  href={`/b/${bookingSlug}/randevu`}
                  scroll={false}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <RotateCcw size={13} />
                  {lang === "tr" ? "Tekrar Randevu Al" : "Book Again"}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

