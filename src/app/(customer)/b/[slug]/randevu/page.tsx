"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  CalendarPlus,
  Download,
  ArrowRight,
  Info,
  Crown,
  AlertCircle,
} from "lucide-react";
import { format, addDays, isSameDay } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { getPalette, paletteCss } from "@/lib/palettes";
import RequirePhoneModal from "@/components/RequirePhoneModal";
import {
  servicesForStaff,
  sortStaffOwnerFirst,
  effectiveDayHours,
  effectiveBookingRules,
  type StaffMember,
} from "@/lib/staff";
import { isTrMobile } from "@/lib/phone";

/** Hizmetin süresini dakika cinsinden döner (kolon adı iki biçimde olabilir). */
function getServiceDuration(svc: ServiceItem): number {
  return svc.duration || svc.duration_minutes || 30;
}

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
  /** Hizmeti veren ekip üyesi (services.staff_id) */
  staff_id?: string | null;
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  /** İşletmenin seçtiği vitrin paleti — randevu ekranı da bu paleti kullanır */
  theme_palette?: string | null;
  profile_image_url?: string | null;
  working_hours?: Record<
    string,
    { isOpen: boolean; openTime: string; closeTime: string }
  >;
  booking_rules?: {
    slotDuration?: number;
    autoApprove?: boolean;
    notifyEmail?: boolean;
    notifySms?: boolean;
    notifyWhatsapp?: boolean;
  };
  phone?: string | null;
  address?: string | null;
}

type TimeFilter = "all" | "morning" | "afternoon" | "evening";

export default function BookPage() {
  const { slug } = useParams();
  const supabase = createClient();
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantItem | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stepper: 1 = Eleman, 2 = Hizmet, 3 = Tarih & Saat, 4 = Onay & Özet
  const [step, setStep] = useState(1);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [serviceSearch, setServiceSearch] = useState("");
  /** Dolu zaman aralıkları (epoch ms). Yalnızca başlangıç saatleri yetmez:
   *  150 dk'lık hizmette 10:00 kaydı 11:00 ve 12:00'i de kapatır. */
  const [busyRanges, setBusyRanges] = useState<{ start: number; end: number }[]>(
    [],
  );
  /** Randevu gönderiminde oluşan hata (alert yerine satır içi gösterilir). */
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [note, setNote] = useState("");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  /** Saat seçimi sonrası otomatik ilerleme zamanlayıcısı (temizlenebilir). */
  const advanceTimerRef = useRef<number | null>(null);

  // Zamanlayıcıyı temizle: bileşen kapanırken ya da adım değişirken
  // yarım kalan ilerleme tetiklenmesin.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  const goToStep = (next: number) => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setStep(next);
  };

  const availableDates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)),
    [],
  );

  // İşletme + hizmetleri yükle. (Veri yükleme effect'in kendi içinde:
  // effect gövdesinde senkron setState çağıran dış fonksiyon çağrılmamalı.)
  useEffect(() => {
    const loadTenant = async () => {
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug)
        .single();

      if (tenantError || !tenantData) {
        // Hata metni render anında `lang`'e göre türetilir; burada yalnızca
        // "işletme bulunamadı" durumunu işaretliyoruz.
        setError("not_found");
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

      // Ekip listesi (herkese açık uç): müşteri önce eleman seçer
      try {
        const res = await fetch(`/api/tenant/${tenantData.id}/staff`);
        const json = await res.json();
        const team = sortStaffOwnerFirst((json?.staff ?? []) as StaffMember[]);
        setStaffList(team);
        // Ekip kaydı yoksa adım atlanır (tek kişilik/eski işletmeler)
        if (team.length === 0) setStep(2);
      } catch {
        setStaffList([]);
        setStep(2);
      }

      setLoading(false);
    };

    loadTenant();
    // `lang` bilerek bağımlılık DEĞİL: dil değiştirmek randevu akışını
    // baştan yüklememeli (akış sıfırlanıyordu). Hata mesajı render anında
    // `lang`'e göre türetilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, supabase]);

  // Seçilen elemanın o günkü dolu saatleri.
  // Not: `appointments` RLS'i müşteriye sadece kendi randevularını gösterir, bu
  // yüzden dolu saatler sunucu ucundan (yalnızca başlangıç zamanları) çekilir.
  useEffect(() => {
    const loadBookedSlots = async () => {
      if (!tenant || !selectedDate) return;
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Sorgu penceresi, önceki gün başlayıp bu güne taşan kayıtları da
      // kapsamalı; bu yüzden bir gün öncesinden/sonrasından istenir.
      const query = new URLSearchParams({
        from: new Date(startOfDay.getTime() - 86400000).toISOString(),
        to: new Date(endOfDay.getTime() + 86400000).toISOString(),
      });
      if (selectedStaff) query.set("staffId", selectedStaff.id);

      try {
        const res = await fetch(
          `/api/tenant/${tenant.id}/availability?${query.toString()}`,
        );
        const json = await res.json();
        const ranges: { start: string; end?: string }[] =
          json?.busyRanges ?? [];

        // Tek geçişte hem dönüştür hem geçersizleri ele (map + filter yerine).
        const parsed: { start: number; end: number }[] = [];
        for (const r of ranges) {
          const start = new Date(r.start).getTime();
          const end = new Date(
            r.end ?? new Date(r.start).getTime() + 3600000,
          ).getTime();
          if (Number.isFinite(start) && Number.isFinite(end)) {
            parsed.push({ start, end });
          }
        }
        setBusyRanges(parsed);
      } catch {
        setBusyRanges([]);
      }
    };

    loadBookedSlots();
  }, [tenant, selectedDate, selectedStaff]);

  /**
   * Seçilen saat, mevcut bir randevuyla ÇAKIŞIYOR mu?
   * Randevunun süresi (hizmet süresi) hesaba katılır; böylece kullanıcı
   * yalnızca reddedilecek bir saati seçip akışı baştan yaşamaz.
   */
  const clearBookingError = () => {
    if (bookingError) setBookingError(null);
  };

  const isSlotBusy = (time: string) => {
    if (!selectedService || busyRanges.length === 0) return false;
    const [hour, minute] = time.split(":").map(Number);
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hour, minute, 0, 0);
    const start = slotStart.getTime();
    const end = start + getServiceDuration(selectedService) * 60000;
    return busyRanges.some((r) => start < r.end && end > r.start);
  };

  /**
   * Verilen gün için uygun saatleri üretir.
   *
   * KRİTİK: Son saat dilimi, hizmet süresi de hesaba katılarak seçilir.
   * Sunucu (`/api/book`) "randevu kapanış saatinden önce bitmeli" kuralını
   * uygular; burası yalnızca ızgara adımını (slotDuration) kontrol ettiği için
   * 150 dakikalık bir hizmette 20:00 gibi imkânsız saatler öneriliyor ve
   * kullanıcı akışı baştan yaşayıp 409 hatası alıyordu.
   */
  const getAvailableTimeSlots = useCallback(
    (date: Date) => {
      // Randevu kuralları elemana özel olabilir: eleman slot aralığı girdiyse
      // onunki, girmediyse işletmeninki geçerli olur.
      const rules = effectiveBookingRules(
        selectedStaff?.booking_rules,
        tenant?.booking_rules,
      );
      const slotDuration = rules.slotDuration;
      // Hizmet seçilmediyse adım süresi kadar varsayılır.
      const serviceDuration = selectedService
        ? getServiceDuration(selectedService)
        : slotDuration;

      const dayOfWeek = date.getDay();
      const dayName = Object.keys(dayMap).find(
        (key) => dayMap[key] === dayOfWeek,
      );
      if (!dayName) return [];

      // Seçilen elemanın o güne ait kendi saat ayarı varsa o, yoksa işletmenin
      // saati uygulanır (eleman hiç ayar yapmamışsa işletme saati geçerlidir).
      const hours =
        effectiveDayHours(
          selectedStaff?.working_hours,
          tenant?.working_hours,
          dayName,
        ) ?? defaultWorkingHours[dayName];
      if (!hours.isOpen) return [];

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
        // Hizmet kapanış saatine kadar bitmeli (sunucudaki kuralın aynısı).
        if (m + serviceDuration > closeTotal) continue;
        const h = Math.floor(m / 60);
        const min = m % 60;
        slots.push(
          `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`,
        );
      }
        return slots;
      },
    [tenant, selectedService, selectedStaff],
  );

  const filteredSlots = useMemo(() => {
    const allSlots = getAvailableTimeSlots(selectedDate);
    return allSlots.filter((slot) => {
      const [hourStr, minStr] = slot.split(":");
      const hour = parseInt(hourStr);
      const min = parseInt(minStr);
      const total = hour * 60 + min;
      if (timeFilter === "morning") return total < 12 * 60;
      if (timeFilter === "afternoon")
        return total >= 12 * 60 && total < 17 * 60;
      if (timeFilter === "evening") return total >= 17 * 60;
      return true;
    });
  }, [selectedDate, timeFilter, getAvailableTimeSlots]);

  /**
   * Seçilen tarihin GEÇERLİ saatleri: elemanın kendi ayarı varsa onlar, yoksa
   * işletme saati. Saat ızgarasının üstünde müşteriye gösterilir.
   */
  const effectiveHours = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    const dayName = Object.keys(dayMap).find(
      (k) => dayMap[k] === dayOfWeek,
    );
    if (!dayName) return null;

    const staffOwn = selectedStaff?.working_hours?.[dayName];
    if (staffOwn) {
      return {
        source: "staff" as const,
        name: selectedStaff?.full_name?.trim() || "",
        hours: staffOwn,
      };
    }
    const tenantHours = tenant?.working_hours?.[dayName];
    if (tenantHours) {
      return { source: "tenant" as const, name: "", hours: tenantHours };
    }
    return null;
  }, [selectedDate, selectedStaff, tenant]);

  // Seçilen elemanın hizmetleri (staff_id kolonu yoksa tümü gösterilir)
  const staffServices = useMemo(
    () => servicesForStaff(services, selectedStaff?.id),
    [services, selectedStaff],
  );

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return staffServices;
    const q = serviceSearch.toLowerCase();
    return staffServices.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)),
    );
  }, [staffServices, serviceSearch]);

  // İlk adım her zaman eleman seçimi; ekip kaydı yoksa akış hizmetten başlar.
  const hasStaffStep = staffList.length > 0;
  const wizardSteps = hasStaffStep
    ? [
        {
          num: 1,
          labelTr: "1. Eleman",
          labelTrFull: "1. Eleman Seçimi",
          labelEn: "1. Staff",
          labelEnFull: "1. Choose Staff",
        },
        {
          num: 2,
          labelTr: "2. Hizmet",
          labelTrFull: "2. Hizmet Seçimi",
          labelEn: "2. Service",
          labelEnFull: "2. Service",
        },
        {
          num: 3,
          labelTr: "3. Tarih",
          labelTrFull: "3. Tarih & Saat",
          labelEn: "3. Date",
          labelEnFull: "3. Date & Time",
        },
        {
          num: 4,
          labelTr: "4. Onay",
          labelTrFull: "4. Onay & Not",
          labelEn: "4. Confirm",
          labelEnFull: "4. Confirm",
        },
      ]
    : [
        {
          num: 2,
          labelTr: "1. Hizmet",
          labelTrFull: "1. Hizmet Seçimi",
          labelEn: "1. Service",
          labelEnFull: "1. Service",
        },
        {
          num: 3,
          labelTr: "2. Tarih",
          labelTrFull: "2. Tarih & Saat",
          labelEn: "2. Date",
          labelEnFull: "2. Date & Time",
        },
        {
          num: 4,
          labelTr: "3. Onay",
          labelTrFull: "3. Onay & Not",
          labelEn: "3. Confirm",
          labelEnFull: "3. Confirm",
        },
      ];

  const handleBook = async () => {
    if (!tenant || !selectedService || !selectedDate || !selectedTime) return;
    setBookingLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBookingError(t("booking.need_login"));
      router.push(
        `/login?next=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .single();

    if (!isTrMobile(profile?.phone)) {
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
        staff_id: selectedStaff?.id ?? null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        note,
      }),
    });

    setBookingLoading(false);

    const data = await res.json();
    if (!res.ok || data.error) {
      // `alert()` yerine satır içi hata: mobilde tarayıcı diyaloğu tüm akışı
      // kesiyordu ve sunucu mesajı (ör. "bu saatte başka randevu var")
      // kullanıcı tarafından fark edilmiyordu.
      setBookingError(data.error || t("booking.booking_error"));
    } else {
      setBookingSuccess(true);
    }
  };

  // Google Calendar URL Generator
  const getGoogleCalendarUrl = () => {
    if (!selectedService || !selectedDate || !selectedTime || !tenant)
      return "#";
    const [hour, min] = selectedTime.split(":");
    const start = new Date(selectedDate);
    start.setHours(parseInt(hour), parseInt(min), 0, 0);
    const duration = getServiceDuration(selectedService);
    const end = new Date(start.getTime() + duration * 60000);

    const formatGCal = (d: Date) =>
      d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      `${selectedService.name} - ${tenant.name}`,
    )}&dates=${formatGCal(start)}/${formatGCal(end)}&details=${encodeURIComponent(
      `Randera randevusu: ${selectedService.name} (${tenant.name})`,
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

    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `randevu-${tenant.slug}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // İşletmenin vitrin paleti: randevu ekranı da işletme sayfasıyla aynı
  // vurgu rengini kullanır (`.brand-scope` → --brand* değişkenleri).
  const paletteStyle = (
    <style>{paletteCss(getPalette(tenant?.theme_palette))}</style>
  );

  if (loading) {
    return (
      <div className="brand-scope w-full h-80 flex flex-col items-center justify-center gap-3">
        {paletteStyle}
        <Loader2 className="animate-spin text-[var(--brand)] h-9 w-9" />
        <p className="text-xs text-gray-400 font-medium">
          {t("booking.loading")}
        </p>
      </div>
    );
  }

  if (error || !tenant) {
    // `error` ya sunucudan gelen bir mesaj ya da "not_found" işareti.
    const errorText =
      error === "not_found" ? t("booking.not_found") : error;
    return (
      <div className="brand-scope w-full h-64 flex flex-col items-center justify-center text-red-500 dark:text-red-400 font-medium gap-2">
        {paletteStyle}
        <Info size={28} />
        <span>{errorText}</span>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="brand-scope w-full max-w-lg mx-auto flex flex-col items-center justify-center py-12 px-4 font-sans animate-in fade-in zoom-in-95 duration-500">
        {paletteStyle}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl p-8 sm:p-10 rounded-[36px] shadow-xl border border-white/60 dark:border-slate-800/80 w-full text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-6 ring-8 ring-amber-50 dark:ring-amber-950/30">
            <Clock className="h-10 w-10" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {t("booking.awaiting_approval")}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">
            {t("booking.saved_title")}
          </h2>

          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            <strong className="text-gray-900 dark:text-slate-200">
              {tenant.name}
            </strong>{" "}
            {t("booking.saved_desc")}
          </p>

          {/* Appointment Ticket / Recap */}
          {selectedService && selectedDate && selectedTime && (
            <div className="bg-gray-50/80 dark:bg-slate-800/50 rounded-2xl p-4 text-left border border-gray-100 dark:border-slate-700/60 mb-6 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>{t("booking.service")}:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {selectedService.name}
                </span>
              </div>
              {selectedStaff && (
                <div className="flex justify-between text-gray-500 dark:text-slate-400">
                  <span>{t("booking.staff")}:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {selectedStaff.full_name ?? "-"}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>{t("booking.date_time")}:</span>
                <span className="font-bold text-[var(--brand-text)]">
                  {format(selectedDate, "dd MMMM yyyy", {
                    locale: lang === "tr" ? tr : enUS,
                  })}{" "}
                  - {selectedTime}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>{t("booking.price")}:</span>
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
              <span>{t("booking.add_google")}</span>
            </a>

            <button
              onClick={downloadIcs}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-xs"
            >
              <Download size={16} className="text-[var(--brand-text)]" />
              <span>{t("booking.add_apple")}</span>
            </button>
          </div>

          <button
            onClick={() => router.push("/my-appointments")}
            className="w-full bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[color:var(--brand-shadow)] hover:-translate-y-0.5 transition-all text-sm"
          >
            {t("booking.view_appointments")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-scope w-full max-w-3xl mx-auto space-y-6 pb-12 font-sans px-2">
      {paletteStyle}
      {/* Mini Business Banner */}
      <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/60 dark:border-slate-800/80 shadow-sm">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-slate-800 shadow-sm bg-[var(--brand-soft)] text-[var(--brand-text)] font-black text-lg sm:text-xl">
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
              {t("booking.open")}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {t("booking.wizard")}
          </p>
        </div>
      </div>

      {/* Stepper Wizard Bar */}
      <div
        className={`grid gap-1.5 sm:gap-3 p-1 sm:p-1.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 shadow-xs ${
          hasStaffStep ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        {wizardSteps.map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              onClick={() => {
                if (s.num === 1) goToStep(1);
                if (s.num === 2 && selectedStaff) goToStep(2);
                if (s.num === 3 && selectedService) goToStep(3);
                if (
                  s.num === 4 &&
                  selectedService &&
                  selectedDate &&
                  selectedTime
                )
                  goToStep(4);
              }}
              aria-current={isActive ? "step" : undefined}
              disabled={!isDone && !isActive}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? "bg-[var(--brand)] text-white shadow-md shadow-[color:var(--brand-shadow)]"
                  : isDone
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "text-gray-400 dark:text-slate-500 hover:text-gray-600"
              }`}
            >
              {isDone ? (
                <Check size={13} className="shrink-0" strokeWidth={2.5} />
              ) : null}
              <span className="sm:hidden">
                {lang === "tr" ? s.labelTr : s.labelEn}
              </span>
              <span className="hidden sm:inline">
                {lang === "tr" ? s.labelTrFull : s.labelEnFull}
              </span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: STAFF SELECTION — işletme sahibi vurgulu kart */}
      {step === 1 && hasStaffStep && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t("booking.step_staff")}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t("booking.staff_pick_desc")}
            </p>
          </div>

          <div className="grid gap-3">
            {staffList.map((staff) => {
              const isOwner = staff.role === "owner";
              const displayName =
                staff.full_name?.trim() || t("booking.unnamed");

              return (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaff(staff);
                    setSelectedService(null);
                    setSelectedTime(null);
                    goToStep(2);
                  }}
                  className={`group relative flex items-center justify-between gap-4 overflow-hidden p-5 rounded-3xl border text-left transition-all ${
                    isOwner
                      ? "border-amber-300/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/20 dark:border-amber-400/40 dark:from-amber-950/40 dark:via-slate-900/70 dark:to-slate-900/60"
                      : "bg-white/80 dark:bg-slate-900/60 border-white/60 dark:border-slate-800/80 hover:border-[var(--brand-border)] hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  {isOwner && (
                    <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-300/25 blur-2xl" />
                  )}

                  <div className="relative flex min-w-0 items-center gap-4">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-black ${
                        isOwner
                          ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-4 ring-amber-200/70 dark:ring-amber-500/20"
                          : "bg-[var(--brand-soft)] text-[var(--brand-text)] border-2 border-white dark:border-slate-800"
                      }`}
                    >
                      {staff.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={staff.avatar_url}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-gray-900 dark:text-white">
                          {displayName}
                        </h3>
                        {isOwner && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                            <Crown size={11} strokeWidth={2.5} />
                            {t("booking.owner")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                        {isOwner
                          ? t("booking.owner_sub")
                          : t("booking.team_member")}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                      isOwner
                        ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 group-hover:scale-110"
                        : "bg-gray-100 text-gray-400 group-hover:bg-[var(--brand)] group-hover:text-white dark:bg-slate-800"
                    }`}
                  >
                    <ChevronRight size={18} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: SERVICE SELECTION */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("booking.step_service")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {selectedStaff
                  ? lang === "tr"
                    ? `${selectedStaff.full_name ?? ""} tarafından verilen hizmetler`
                    : `Services provided by ${selectedStaff.full_name ?? ""}`
                  : t("booking.service_pick_desc")}
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
                placeholder={
                  t("booking.search_service")
                }
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] text-gray-800 dark:text-white"
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
                    setSelectedTime(null);
                    clearBookingError();
                    goToStep(3);
                  }}
                  className={`group relative flex items-center justify-between p-5 rounded-3xl border transition-all text-left ${
                    isSelected
                      ? "bg-[var(--brand-soft)] border-[var(--brand)] shadow-md ring-2 ring-[var(--brand)]/20"
                      : "bg-white/80 dark:bg-slate-900/60 border-white/60 dark:border-slate-800/80 hover:border-[var(--brand-border)] hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-[var(--brand-text)] transition-colors">
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
                    <span className="font-black text-xl text-[var(--brand-text)]">
                      ₺{svc.price}
                    </span>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                        isSelected
                          ? "bg-[var(--brand)] text-white"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-400 group-hover:bg-[var(--brand)] group-hover:text-white"
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
                {selectedStaff && services.length > 0
                  ? lang === "tr"
                    ? `${selectedStaff.full_name ?? "Bu eleman"} için tanımlı hizmet bulunmuyor. Lütfen başka bir eleman seçin.`
                    : `No services for ${selectedStaff.full_name ?? "this staff member"}. Please pick someone else.`
                  : t("booking.no_services")}
              </div>
            )}
          </div>

          {hasStaffStep && (
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors w-fit"
            >
              <ChevronLeft size={16} />
              {t("booking.back_to_staff")}
            </button>
          )}
        </div>
      )}

      {/* STEP 3: DATE & TIME SELECTION */}
      {step === 3 && selectedService && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("booking.step_datetime")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {selectedService.name} • ₺{selectedService.price} (
                {getServiceDuration(selectedService)}{" "}
                {t("booking.min_short")})
                {selectedStaff ? ` • ${selectedStaff.full_name ?? ""}` : ""}
              </p>
            </div>
            <button
              onClick={() => goToStep(2)}
              className="text-xs font-bold text-[var(--brand-text)] hover:underline"
            >
              {t("booking.change_service")}
            </button>
          </div>

          {/* 14-Day Horizontal Calendar Scroll */}
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl p-5 rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              {t("booking.select_day")}
            </h3>

            <div className="flex gap-2.5 overflow-x-auto pt-1.5 pb-3.5 px-1 -mx-1 scrollbar-none">
              {availableDates.map((date, i) => {
                const isSelected =
                  selectedDate && isSameDay(date, selectedDate);
                const locale = lang === "tr" ? tr : enUS;
                const isToday = isSameDay(date, new Date());
                const isTomorrow = isSameDay(date, addDays(new Date(), 1));

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime(null);
                      clearBookingError();
                    }}
                    className={`flex flex-col items-center min-w-[74px] p-3 rounded-2xl border transition-all shrink-0 ${
                      isSelected
                        ? "bg-[var(--brand)] border-[var(--brand)] text-white shadow-md shadow-[color:var(--brand-shadow)] scale-[1.02]"
                        : "bg-white/80 dark:bg-slate-800/70 border-gray-200/70 dark:border-slate-700/60 text-gray-700 dark:text-slate-300 hover:border-[var(--brand-border)] hover:-translate-y-0.5"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isSelected
                          ? "text-white/80"
                          : "text-gray-400 dark:text-slate-400"
                      }`}
                    >
                      {isToday
                        ? t("booking.today")
                        : isTomorrow
                          ? t("booking.tomorrow")
                          : format(date, "EEE", { locale })}
                    </span>
                    <span className="text-2xl font-black mt-1 leading-tight">
                      {format(date, "d")}
                    </span>
                    <span
                      className={`text-[10px] font-medium mt-0.5 ${
                        isSelected ? "text-white/80" : "text-gray-400"
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
                  {t("booking.select_time")}
                </h3>

                {/* Time filter pills */}
                <div className="flex items-center justify-between gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 text-[11px] font-bold w-full sm:w-auto">
                  {(
                    [
                      { id: "all", key: "booking.all_times" },
                      { id: "morning", key: "booking.morning" },
                      { id: "afternoon", key: "booking.afternoon" },
                      { id: "evening", key: "booking.evening" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTimeFilter(f.id)}
                      aria-pressed={timeFilter === f.id}
                      className={`flex-1 sm:flex-none text-center px-2.5 py-2 sm:py-1.5 min-h-[36px] rounded-lg transition-all ${
                        timeFilter === f.id
                          ? "bg-white dark:bg-slate-700 text-[var(--brand-text)] shadow-xs font-black"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                      }`}
                    >
                      {t(f.key)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seçilen tarihin geçerli çalışma saatleri: eleman kendi
                  saatini seçmişse onlar, yoksa işletme saati */}
              {effectiveHours && (
                <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--brand-text)]">
                  <Clock size={14} className="shrink-0" />
                  <span>
                    {effectiveHours.source === "staff"
                      ? `${effectiveHours.name}${t("booking.working_hours")}: `
                      : `${t("booking.business_hours")}: `}
                  </span>
                  <span>
                    {effectiveHours.hours.isOpen
                      ? `${effectiveHours.hours.openTime} – ${effectiveHours.hours.closeTime}`
                      : t("booking.closed")}
                  </span>
                </div>
              )}

              {/* Slots Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {filteredSlots.length > 0 ? (
                  filteredSlots.map((time) => {
                    const isBooked = isSlotBusy(time);
                    const isSelected = selectedTime === time;

                    return (
                      <button
                        key={time}
                        disabled={isBooked}
                        onClick={() => {
                          clearBookingError();
                          setSelectedTime(time);
                          // Adımlar 1 tabanlıdır: 3 = Tarih & Saat, 4 = Onay & Not.
                          // Kısa gecikme, seçim animasyonunun görünmesini sağlar.
                          //
                          // Zamanlayıcı SAKLANIR: önceden temizlenmediği için
                          // kullanıcı 220ms içinde başka bir saate ya da "geri"
                          // düğmesine basarsa akış yine de 4. adıma atıyordu.
                          advanceTimerRef.current = window.setTimeout(() => {
                            advanceTimerRef.current = null;
                            setStep(4);
                          }, 220);
                        }}
                        className={`py-3 rounded-2xl text-xs sm:text-sm font-black border transition-all ${
                          isSelected
                            ? "bg-[var(--brand)] border-[var(--brand)] text-white shadow-md shadow-[color:var(--brand-shadow)] scale-[1.04]"
                            : isBooked
                              ? "bg-gray-100 dark:bg-slate-800/40 border-transparent text-gray-300 dark:text-slate-600 cursor-not-allowed line-through"
                              : "bg-white/80 dark:bg-slate-800/80 border-gray-200/70 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] active:scale-95"
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

              {/* Step 3 Bottom Navigation & Continue Action Bar */}
              <div className="mt-8 pt-5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors w-fit"
                >
                  <ChevronLeft size={16} />
                  <span>
                    {t("booking.back_to_services")}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => goToStep(4)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-white font-black text-xs sm:text-sm shadow-md shadow-[color:var(--brand-shadow)] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
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

      {/* STEP 4: CONFIRMATION & NOTES */}
      {step === 4 && selectedService && selectedDate && selectedTime && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t("booking.step_summary")}
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-slate-800 shadow-sm bg-[var(--brand-soft)] text-[var(--brand-text)] font-black text-lg">
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
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {tenant.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {lang === "tr"
                      ? "Doğrulanmış İşletme"
                      : "Verified Business"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block font-medium">
                  {t("booking.total")}
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₺{selectedService.price}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-6 border-b border-dashed border-gray-200 dark:border-slate-800 text-xs sm:text-sm">
              <div>
                <span className="text-gray-400 block mb-1">
                  {t("booking.selected_service")}
                </span>
                <p className="font-bold text-gray-800 dark:text-slate-200">
                  {selectedService.name}
                </p>
                <span className="text-xs text-[var(--brand-text)] font-semibold">
                  {getServiceDuration(selectedService)}{" "}
                  {lang === "tr" ? "dakika" : "minutes"}
                </span>
              </div>

              {selectedStaff && (
                <div>
                  <span className="text-gray-400 block mb-1">
                    {t("booking.staff")}
                  </span>
                  <p className="font-bold text-gray-800 dark:text-slate-200">
                    {selectedStaff.full_name ?? "-"}
                  </p>
                  {selectedStaff.role === "owner" && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <Crown size={12} strokeWidth={2.5} />
                      {t("booking.owner")}
                    </span>
                  )}
                </div>
              )}

              <div>
                <span className="text-gray-400 block mb-1">
                  {t("booking.date_time")}
                </span>
                <p className="font-bold text-gray-800 dark:text-slate-200">
                  {format(selectedDate, "dd MMMM yyyy, EEEE", {
                    locale: lang === "tr" ? tr : enUS,
                  })}
                </p>
                <span className="text-xs text-[var(--brand-text)] font-bold">
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
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-xs sm:text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none"
              />
            </div>

            {/* Sunucu hatası (ör. saat artık müsait değil): alert() yerine
                satır içi, kapatılabilir uyarı — mobilde tarayıcı diyaloğu
                akışı kesiyordu ve mesaj fark edilmiyordu. */}
            {bookingError && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 dark:border-red-500/30 dark:bg-red-950/40"
              >
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                />
                <p className="flex-1 text-[12.5px] font-semibold leading-snug text-red-700 dark:text-red-300">
                  {bookingError}
                </p>
                <button
                  type="button"
                  onClick={() => setBookingError(null)}
                  aria-label={t("booking.dismiss")}
                  className="shrink-0 rounded-full px-1.5 text-red-500 active:scale-90 dark:text-red-400"
                >
                  ×
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="inline-flex items-center justify-center gap-2 pl-4 pr-5 py-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer select-none shrink-0"
              >
                <ChevronLeft
                  size={18}
                  className="-ml-0.5 text-slate-500 dark:text-slate-400"
                />
                <span>{t("booking.back")}</span>
              </button>

              <button
                type="button"
                disabled={bookingLoading}
                onClick={handleBook}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-white text-sm font-black shadow-lg shadow-[color:var(--brand-shadow)] hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50"
              >                {bookingLoading ? (
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

      {currentUserId && (
        <RequirePhoneModal
          isOpen={showPhoneModal}
          onSuccess={() => {
            setShowPhoneModal(false);
            handleBook();
          }}
        />
      )}
    </div>
  );
}
