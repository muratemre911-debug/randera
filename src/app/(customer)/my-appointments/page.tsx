"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO, isAfter } from "date-fns";
import type { Locale } from "date-fns";
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
  CheckCircle2, 
  AlertCircle, 
  Compass, 
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
import Modal from "@/components/ui/Modal";
import DropdownMenu from "@/components/ui/DropdownMenu";
import {
  effectiveBookingRules,
  type BookingRulesInput,
} from "@/lib/staff";

/** Bilinmeyen (unknown) hata değerinden gösterilebilir mesaj çıkarır. */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface Appointment {
  id: string;
  customer_id: string | null;
  tenant_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  /** Randevuyu verecek ekip üyesi (staff_settings sahibi) */
  staff_id?: string | null;
  /**
   * Elemana özel randevu kuralları — fetch sırasında staff_settings'ten
   * eklenir. Boş bıraktığı alanlarda işletme kuralları geçerli olur.
   */
  staff_booking_rules?: BookingRulesInput | null;
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
  const getCancelMode = (
    appt: Appointment,
    currentTime: number,
  ): "direct" | "request" => {
    const deadline = getCancelDeadline(appt);
    const hoursLeft = (new Date(appt.start_time).getTime() - currentTime) / 3600000;
    return hoursLeft >= deadline ? "direct" : "request";
  };

  /**
   * Geçerli iptal süresi: eleman kendi süresini belirlediyse onunki, aksi
   * halde işletmenin süresi (yoksa 24 saat).
   */
  const getCancelDeadline = (appt: Appointment): number =>
    effectiveBookingRules(appt.staff_booking_rules, appt.tenants?.booking_rules)
      .cancelDeadlineHours;

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
      // SAFETY: Supabase'in iç içe select sonucu derinlemesine tiplenmiyor;
      // dönen satırlar appointments şemasına birebir karşılık gelir (mevcut
      // kullanım da bu şekildeydi).
      const rows = appts as unknown as Appointment[];

      // Elemana özel kurallar: staff_settings doğrudan randevuya bağlı olmadığı
      // için (appointments.staff_id → profiles.id) ilgili elemanların
      // ayarları tek sorguda çekilip randevulara iliştirilir.
      const staffIds = [
        ...new Set(
          rows
            .map((a) => a.staff_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const rulesByStaff = new Map<string, BookingRulesInput>();
      if (staffIds.length > 0) {
        const { data: settingsRows } = await supabase
          .from("staff_settings")
          .select("profile_id, booking_rules")
          .in("profile_id", staffIds);
        for (const row of settingsRows ?? []) {
          if (row.booking_rules) {
            // SAFETY: booking_rules JSONB içeriği bizim yazdığımız
            // BookingRulesInput biçimindedir (ayarlar ekranı).
            rulesByStaff.set(
              row.profile_id,
              row.booking_rules as BookingRulesInput,
            );
          }
        }
      }

      setAppointments(
        rows.map((a) => ({
          ...a,
          staff_booking_rules: a.staff_id
            ? (rulesByStaff.get(a.staff_id) ?? null)
            : null,
        })),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    // Mount'ta veri çekme. fetchAppointments async olsa da ilk işi
    // setLoading(true) olduğu için kural tetikleniyor; burada kasıtlı ve
    // tek seferlik bir yükleme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    } catch (err) {
      setNotification({
        message: errorMessage(
          err,
          lang === "tr" ? "İptal sırasında bir hata oluştu." : "Failed to cancel appointment.",
        ),
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
    } catch (err) {
      setNotification({
        message: errorMessage(
          err,
          lang === "tr" ? "İstek gönderilirken bir hata oluştu." : "Failed to send request.",
        ),
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
          // İptal isteği alanları temizlenir; kalan custom_fields korunur.
          // (Destructure yerine delete: kullanılmayan değişken üretmez.)
          const rest = { ...(a.custom_fields || {}) };
          delete rest.cancel_requested;
          delete rest.cancel_reason;
          delete rest.cancel_requested_at;
          return { ...a, custom_fields: rest };
        })
      );

      setNotification({
        message: lang === "tr" ? "İptal isteğiniz geri çekildi. Randevunuz geçerli." : "Request withdrawn. Your appointment is still valid.",
        type: "success",
      });
      setWithdrawingAppt(null);

      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      setNotification({
        message: errorMessage(
          err,
          lang === "tr" ? "İşlem sırasında bir hata oluştu." : "Something went wrong.",
        ),
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
  // Anlık zaman dışarıdan verilir: bileşen gövdesinde doğrudan saat okumak
  // (Date.now) render'ı düzensiz kılar. Çağıran, render'daki "now" değerini geçer.
  const getCountdownText = (startTime: string, currentTime: number) => {
    const target = new Date(startTime);
    const diffMs = target.getTime() - currentTime;
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
        <div className="w-10 h-10 border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
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
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
            {lang === "tr" ? "Randevularım" : "My Appointments"}
            <span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-text)]">
              {upcomingAppointments.length} {lang === "tr" ? "Yaklaşan" : "Upcoming"}
            </span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {lang === "tr"
              ? "Tüm randevularınızı görüntüleyin, takviminize kaydedin veya kolayca yönetin."
              : "Track all your appointments, add to calendar, or manage booking status."}
          </p>
        </div>

        <Link
          href="/discover"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-[0_6px_16px_var(--brand-shadow)] transition-all active:scale-[0.98] self-start sm:self-auto"
        >
          <Compass size={16} />
          {lang === "tr" ? "Yeni Randevu Keşfet" : "Explore Businesses"}
        </Link>
      </div>

      {/* Hero Spotlight: En Yakın Randevu Kartı (Varsa) */}
      {nearestUpcoming && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-text)]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {lang === "tr"
                    ? "Sıradaki Randevunuz"
                    : "Next Upcoming Appointment"}{" "}
                  • {getCountdownText(nearestUpcoming.start_time, now.getTime())}
                </span>
              </span>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white md:text-2xl">
                {nearestUpcoming.services?.name || (lang === "tr" ? "Hizmet" : "Service")}
              </h2>
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                <Building2 size={15} className="shrink-0" />
                <span>
                  {nearestUpcoming.tenants?.name || (lang === "tr" ? "İşletme" : "Business")}
                </span>
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
              <div className="rounded-2xl bg-slate-50 p-3 text-left dark:bg-slate-800/60">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {format(parseISO(nearestUpcoming.start_time), "EEEE", { locale })}
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {format(parseISO(nearestUpcoming.start_time), "d MMMM yyyy", { locale })}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Clock size={13} className="shrink-0" />
                  <span>
                    {format(parseISO(nearestUpcoming.start_time), "HH:mm")}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={createGoogleCalendarUrl(nearestUpcoming)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 transition-all active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
                >
                  <CalendarPlus size={14} className="shrink-0" />
                  <span className="truncate">Google Takvim</span>
                </a>
                <button
                  onClick={() => downloadIcsFile(nearestUpcoming)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 transition-all active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all md:text-sm ${
              activeTab === "upcoming"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Calendar size={15} />
            {lang === "tr" ? "Yaklaşan Randevular" : "Upcoming"} ({upcomingAppointments.length})
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all md:text-sm ${
              activeTab === "past"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)]">
              <Calendar size={32} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
              {lang === "tr" ? "Yaklaşan Randevunuz Yok" : "No Upcoming Appointments"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              {lang === "tr"
                ? "Randera üzerinden kayıtlı kuaför, klinik, güzellik ve bakım işletmelerinden dilediğiniz gibi randevu oluşturabilirsiniz."
                : "Explore top-rated businesses and book appointments seamlessly on Randera."}
            </p>
            <Link
              href="/discover"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-[0_6px_16px_var(--brand-shadow)] transition-all active:scale-[0.98]"
            >
              <Compass size={15} />
              {lang === "tr" ? "Hemen İşletme Bul" : "Find Businesses Now"}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Onaylanan Randevular */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h2 className="text-[15px] font-black tracking-tight text-slate-900 dark:text-white md:text-lg">
                  {lang === "tr" ? "Onaylanan Randevular" : "Confirmed Appointments"}
                </h2>
                <span className="rounded-full border border-emerald-200/50 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  {confirmedUpcoming.length}
                </span>
              </div>
              {confirmedUpcoming.length === 0 ? (
                <p className="px-1 py-2 text-sm text-slate-400 dark:text-slate-500">
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
                      cancelMode={getCancelMode(appt, now.getTime())}
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
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-[15px] font-black tracking-tight text-slate-900 dark:text-white md:text-lg">
                  {lang === "tr" ? "Onay Bekleyen Randevular" : "Pending Approval"}
                </h2>
                <span className="rounded-full border border-amber-200/50 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  {pendingUpcoming.length}
                </span>
              </div>
              {pendingUpcoming.length === 0 ? (
                <p className="px-1 py-2 text-sm text-slate-400 dark:text-slate-500">
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
                      cancelMode={getCancelMode(appt, now.getTime())}
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
          <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)]">
            <Clock className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
              {lang === "tr" ? "Geçmiş Randevunuz Bulunmuyor" : "No Past Appointments"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
        const isRequest = getCancelMode(cancellingAppt, now.getTime()) === "request";
        return (
        <Modal
          open={Boolean(cancellingAppt)}
          onClose={() => { setCancellingAppt(null); setCancelReason(""); }}
          title={
            isRequest
              ? lang === "tr" ? "İptal İsteği Gönder" : "Request Cancellation"
              : lang === "tr" ? "Randevuyu İptal Et" : "Cancel Appointment"
          }
          showTitle={false}
          sheetOnMobile
          footer={
            <div className="flex items-center gap-3">
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
          }
        >
          <div className="space-y-5">
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
                <label
                  htmlFor="cancel-reason"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
                >
                  {lang === "tr" ? "İptal Sebebiniz (opsiyonel)" : "Reason (optional)"}
                </label>
                <textarea
                  id="cancel-reason"
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
          </div>
        </Modal>
        );
      })()}

      {/* Talebi Geri Çek Onay Modalı */}
      {withdrawingAppt && (
        <Modal
          open={Boolean(withdrawingAppt)}
          onClose={() => setWithdrawingAppt(null)}
          title={lang === "tr" ? "Talebi Geri Çek" : "Withdraw Request"}
          showTitle={false}
          sheetOnMobile
          footer={
            <div className="flex items-center gap-3">
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
          }
        >
          <div className="space-y-4">
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
          </div>
        </Modal>
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
  locale: Locale;
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

  return (
    <div
      className={`rounded-3xl border bg-white p-4 shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] transition-all dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)] ${
        isCancelled
          ? "border-rose-200/80 opacity-90 dark:border-rose-500/30"
          : isPending
          ? "border-amber-200/80 dark:border-amber-500/30"
          : isCompleted
          ? "border-slate-200/80 dark:border-slate-800"
          : "border-emerald-200/80 dark:border-emerald-500/30"
      }`}
    >
      <div className="flex gap-3.5">
        {/* Tarih ve Saat */}
        <div className="flex w-[66px] shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-50 py-2.5 dark:bg-slate-800/60">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {format(parseISO(appt.start_time), "MMMM", { locale })}
          </span>
          <span className="text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">
            {format(parseISO(appt.start_time), "d")}
          </span>
          <span className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {format(parseISO(appt.start_time), "EEEE", { locale })}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-200">
            <Clock size={11} />
            {format(parseISO(appt.start_time), "HH:mm")}
          </span>
        </div>

        {/* İşletme, hizmet ve durum */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <Building2 size={13} className="shrink-0 text-[var(--brand-text)]" />
                  <span className="truncate">
                    {appt.tenants?.name || (lang === "tr" ? "İşletme" : "Business")}
                  </span>
                </span>
                {bookingSlug && (
                  <Link
                    href={`/b/${bookingSlug}`}
                    scroll={false}
                    className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--brand-text)] hover:underline"
                  >
                    {lang === "tr" ? "Profili Gör" : "Profile"}
                    <ExternalLink size={11} />
                  </Link>
                )}
              </div>

              <h3 className="mt-1 text-[15px] font-bold text-slate-900 dark:text-white">
                {appt.services?.name || (lang === "tr" ? "Randevu Hizmeti" : "Service")}
              </h3>
              {appt.services?.price != null && (
                <span className="mt-0.5 inline-block text-xs font-extrabold tabular-nums text-[var(--brand-text)]">
                  ₺{appt.services.price.toLocaleString("tr-TR")}
                </span>
              )}
            </div>

            {/* Durum Rozeti */}
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isCancelled
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                  : isCompleted
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  : isPending
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              }`}
            >
              {isPending && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
              {!isCancelled && !isPast && !isPending && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
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
                  ? "Onay Bekliyor"
                  : "Pending Approval"
                : lang === "tr"
                ? "Onaylandı"
                : "Confirmed"}
            </span>
          </div>

          {/* Konum ve Telefon */}
          <div className="mt-2 grid gap-1.5 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            {appt.tenants?.address ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-[var(--brand-text)]"
              >
                <MapPin size={14} className="shrink-0 text-slate-400" />
                <span className="truncate">{appt.tenants.address}</span>
              </a>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin size={14} className="shrink-0" />
                {lang === "tr" ? "Adres belirtilmemiş" : "No address specified"}
              </span>
            )}

            {appt.tenants?.phone && (
              <a
                href={`tel:${appt.tenants.phone}`}
                className="flex items-center gap-1.5 transition-colors hover:text-[var(--brand-text)]"
              >
                <Phone size={14} className="shrink-0 text-slate-400" />
                <span>{appt.tenants.phone}</span>
              </a>
            )}
          </div>

          {/* Randevu Notu */}
          {appt.custom_fields?.note && (
            <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs italic text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              &ldquo;{appt.custom_fields.note}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Sağ Alt: Aksiyon Butonları (Yaklaşan randevularda zengin aksiyonlar) */}
      {!isPast && !isCancelled && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {/* Sol: Şık Takvime Ekle Açılır Menüsü.
              Portal ile açılır: eski hâli sayfa kaydırma kabının içinde
              konumlandığı için yukarı açıldığında kırpılıyordu. */}
          <DropdownMenu
            open={calendarMenuOpen}
            onOpenChange={setCalendarMenuOpen}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-all active:scale-[0.98] hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            trigger={
              <>
                <CalendarPlus size={13} className="text-[var(--brand-text)]" />
                <span>
                  {lang === "tr" ? "Takvime Ekle" : "Add to Calendar"}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-slate-400 transition-transform duration-200 ${
                    calendarMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </>
            }
          >
            <a
              href={onGoogleCal(appt)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCalendarMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] dark:text-slate-200"
            >
              <CalendarPlus size={14} className="shrink-0 text-blue-500" />
              <span>{lang === "tr" ? "Google Takvim" : "Google Calendar"}</span>
            </a>
            <button
              type="button"
              onClick={() => {
                onDownloadIcs(appt);
                setCalendarMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] dark:text-slate-200"
            >
              <Download size={14} className="shrink-0 text-[var(--brand-text)]" />
              <span>
                {lang === "tr" ? "Apple Takvim (.ics)" : "Apple Calendar (.ics)"}
              </span>
            </button>
          </DropdownMenu>

          {/* Sağ: Yol Tarifi ve İptal / Vazgeç Butonları.
              360px'te üç buton yan yana sığmadığı için satır kaydırma
              (flex-wrap) açık; aksi halde yatay taşma oluyordu. */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {appt.tenants?.address && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <MapPin size={13} />
                <span>{lang === "tr" ? "Yol Tarifi" : "Directions"}</span>
              </a>
            )}

            {cancelRequested ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200/50 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 sm:px-3 sm:text-xs">
                  <Clock size={12} />
                  <span>{lang === "tr" ? "İstek İletildi" : "Request Sent"}</span>
                </span>
                <button
                  onClick={onWithdrawPrompt}
                  title={lang === "tr" ? "Talebi Geri Çek" : "Withdraw Request"}
                  className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:px-3 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <Undo2 size={13} />
                  <span>{lang === "tr" ? "Vazgeç" : "Withdraw"}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onCancelPrompt}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
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
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {!isCancelled && onReviewPrompt ? (
            <button
              type="button"
              onClick={onReviewPrompt}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                appt.custom_fields?.review
                  ? "border border-amber-200/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                  : "border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand-soft-hover)]"
              }`}
            >
              <Star
                size={13}
                className={
                  appt.custom_fields?.review
                    ? "fill-amber-400 text-amber-400"
                    : "text-[var(--brand-text)]"
                }
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
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-text)] hover:underline"
            >
              <RotateCcw size={13} />
              {lang === "tr" ? "Tekrar Randevu Al" : "Book Again"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

