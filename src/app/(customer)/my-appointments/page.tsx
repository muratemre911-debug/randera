"use client";

import { useEffect, useState, useMemo } from "react";
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
  XCircle, 
  Compass, 
  AlertTriangle, 
  ExternalLink,
  RotateCcw,
  Undo2,
  Loader2,
  Star,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewModal from "@/components/ReviewModal";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { AppointmentsSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ui/Toast";
import Presence from "@/components/ui/Presence";
import {
  effectiveBookingRules,
  type BookingRulesInput,
} from "@/lib/staff";
import { notifyPanelChange, subscribePanelChanges } from "@/lib/panelEvents";

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
  const { toast } = useToast();

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
    toast(
      lang === "tr" ? "Değerlendirmeniz başarıyla kaydedildi!" : "Review submitted successfully!",
      "success",
    );
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

  const fetchAppointments = async (quiet = false) => {
    if (!quiet) setLoading(true);
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

  useEffect(() => {
    return subscribePanelChanges(["appointments"], () => {
      void fetchAppointments(true);
    });
    // fetchAppointments yalnızca bu mounted sayfanın oturum istemcisini kullanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      notifyPanelChange("appointments");

      toast(
        lang === "tr" ? "Randevunuz başarıyla iptal edildi." : "Appointment cancelled successfully.",
        "success",
      );
      setCancellingAppt(null);
    } catch (err) {
      toast(
        errorMessage(
          err,
          lang === "tr" ? "İptal sırasında bir hata oluştu." : "Failed to cancel appointment.",
        ),
        "error",
      );
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
      notifyPanelChange("appointments");

      toast(
        lang === "tr" ? "İptal isteğiniz işletmeye iletildi." : "Cancellation request sent to the business.",
        "success",
      );
      setCancellingAppt(null);
      setCancelReason("");
    } catch (err) {
      toast(
        errorMessage(
          err,
          lang === "tr" ? "İstek gönderilirken bir hata oluştu." : "Failed to send request.",
        ),
        "error",
      );
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
      notifyPanelChange("appointments");

      toast(
        lang === "tr" ? "İptal isteğiniz geri çekildi. Randevunuz geçerli." : "Request withdrawn. Your appointment is still valid.",
        "success",
      );
      setWithdrawingAppt(null);
    } catch (err) {
      toast(
        errorMessage(
          err,
          lang === "tr" ? "İşlem sırasında bir hata oluştu." : "Something went wrong.",
        ),
        "error",
      );
    } finally {
      setWithdrawLoading(false);
    }
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

  if (loading) {
    return <AppointmentsSkeleton />;
  }

  return (
    <PullToRefresh
      onRefresh={() => fetchAppointments(true)}
      refreshingLabel={lang === "tr" ? "Yenileniyor..." : "Refreshing..."}
    >
    <div className="mx-auto max-w-5xl space-y-6 pb-16 font-sans sm:space-y-8">
      {/* Header */}
      <div className="relative isolate overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 px-5 py-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/15" />
        <div className="pointer-events-none absolute -bottom-28 right-1/3 h-48 w-48 rounded-full bg-fuchsia-400/10 blur-3xl dark:bg-fuchsia-500/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {lang === "tr" ? "Randevularım" : "My Appointments"}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-300" />
                {upcomingAppointments.length} {lang === "tr" ? "Yaklaşan" : "Upcoming"}
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
              {lang === "tr"
                ? "Yaklaşan ve geçmiş randevularınızı buradan görüntüleyip yönetin."
                : "View and manage your upcoming and past appointments here."}
            </p>
          </div>

          <Link
            href="/discover"
            className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/30 active:translate-y-0 active:scale-[0.98] dark:shadow-indigo-950/40"
          >
            <Compass size={17} />
            {lang === "tr" ? "Yeni Randevu Keşfet" : "Explore Businesses"}
            <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      {/* Sekmeler: iOS tarzı kayan kapsüllü segmented control */}
      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          {
            value: "upcoming",
            icon: Calendar,
            badge: upcomingAppointments.length,
            ariaLabel: lang === "tr" ? "Yaklaşan Randevular" : "Upcoming Appointments",
            label: (
              <>
                <span className="sm:hidden">{lang === "tr" ? "Yaklaşan" : "Upcoming"}</span>
                <span className="hidden sm:inline">
                  {lang === "tr" ? "Yaklaşan Randevular" : "Upcoming"}
                </span>
              </>
            ),
          },
          {
            value: "past",
            icon: Clock,
            badge: pastAppointments.length,
            ariaLabel: lang === "tr" ? "Geçmiş ve İptaller" : "Past and Cancelled",
            label: (
              <>
                <span className="sm:hidden">{lang === "tr" ? "Geçmiş" : "Past"}</span>
                <span className="hidden sm:inline">
                  {lang === "tr" ? "Geçmiş & İptaller" : "Past & Cancelled"}
                </span>
              </>
            ),
          },
        ]}
      />

      {/* Randevu Kartları Listesi: sekme değişimi yumuşak geçişle yaşanır. */}
      <Presence
        swapKey={activeTab}
        enterClassName="animate-fade-rise-in"
        exitClassName="animate-fade-rise-out"
      >
      {activeTab === "upcoming" ? (
        upcomingAppointments.length === 0 ? (
          <div className="relative isolate overflow-hidden rounded-[30px] border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/50 to-violet-50/70 px-5 py-10 text-center shadow-[0_18px_55px_-32px_rgba(79,70,229,0.28)] dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 sm:px-8 sm:py-14">
            <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/10" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/10" />
            <div className="relative mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[26px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/25 dark:shadow-indigo-950/50">
              <CalendarDays size={34} strokeWidth={1.9} />
            </div>
            <h3 className="relative text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              {lang === "tr" ? "Yaklaşan Randevunuz Yok" : "No Upcoming Appointments"}
            </h3>
            <p className="relative mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
              {lang === "tr"
                ? "Randera üzerinden kayıtlı kuaför, klinik, güzellik ve bakım işletmelerinden dilediğiniz gibi randevu oluşturabilirsiniz."
                : "Explore top-rated businesses and book appointments seamlessly on Randera."}
            </p>
            <Link
              href="/discover"
              className="group relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/30 active:translate-y-0 active:scale-[0.98] dark:shadow-indigo-950/40"
            >
              <Compass size={16} />
              {lang === "tr" ? "Hemen İşletme Bul" : "Find Businesses Now"}
              <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
                <div className="stagger-list space-y-4">
                  {confirmedUpcoming.map((appt) => (
                    <BoardingPassCard
                      key={appt.id}
                      appt={appt}
                      isPast={false}
                      lang={lang}
                      locale={locale}
                      cancelMode={getCancelMode(appt, now.getTime())}
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
                <div className="stagger-list space-y-4">
                  {pendingUpcoming.map((appt) => (
                    <BoardingPassCard
                      key={appt.id}
                      appt={appt}
                      isPast={false}
                      lang={lang}
                      locale={locale}
                      cancelMode={getCancelMode(appt, now.getTime())}
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
          <div className="relative isolate overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/80 px-5 py-10 text-center shadow-[0_18px_55px_-32px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 sm:px-8 sm:py-14">
            <div className="mx-auto mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <Clock size={30} />
            </div>
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              {lang === "tr" ? "Geçmiş Randevunuz Bulunmuyor" : "No Past Appointments"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
              {lang === "tr" ? "Daha önce tamamlanan bir randevunuz bulunmuyor." : "You have no completed or cancelled appointments yet."}
            </p>
          </div>
        ) : (
          <div className="stagger-list space-y-4">
            {pastAppointments.map((appt) => (
              <BoardingPassCard
                key={appt.id}
                appt={appt}
                isPast={true}
                lang={lang}
                locale={locale}
                onCancelPrompt={() => {}}
                onReviewPrompt={() => setReviewAppt(appt)}
              />
            ))}
          </div>
        )
      )}
      </Presence>

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
    </PullToRefresh>
  );
}

// Boarding-Pass / Ticket Bileti Bileşeni
function BoardingPassCard({
  appt,
  isPast,
  lang,
  locale,
  cancelMode = "direct",
  onCancelPrompt,
  onWithdrawPrompt,
  onReviewPrompt,
}: {
  appt: Appointment;
  isPast: boolean;
  lang: string;
  locale: Locale;
  cancelMode?: "direct" | "request";
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
          {/* Yol Tarifi ve İptal / Vazgeç Butonları dar ekranlarda sarılabilir. */}
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
