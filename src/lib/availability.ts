/**
 * İşletme müsaitlik hesabı (paylaşılan, saf mantık).
 *
 * Bu modül "bugün müsait" bilgisinin TEK kaynağıdır. Hem keşfet/favoriler
 * ekranındaki rozet ve filtre, hem de randevu sihirbazının saat ızgarası bu
 * hesabı kullanır; böylece ekranda gösterilen ile sunucunun kabul ettiği
 * şey birbirinden ayrılmaz.
 *
 * Kritik ayrıntı — zaman dilimi:
 * Randevular ISO (UTC) olarak saklanır ama işletme saatleri İstanbul
 * yerel saatine göre tanımlanır. `POST /api/book` da tarih kararlarını
 * `Europe/Istanbul` üzerinden verir. Bu yüzden burada da AYNI zaman dilimi
 * kullanılır; aksi halde yaz saati sınırlarında "bugün" 1 saat kayar ve
 * yanlış gün açık/kapalı görünür.
 */

/** İşletme saatlerinin tanımlandığı zaman dilimi (sunucu ile aynı). */
export const TURKEY_TIMEZONE = "Europe/Istanbul";

/** Haftanın günleri, veritabanındaki `working_hours` anahtarlarıyla birebir. */
export const DAY_KEYS = [
  "pazartesi",
  "sali",
  "carsamba",
  "persembe",
  "cuma",
  "cumartesi",
  "pazar",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export interface WorkingDay {
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
}

export type WorkingHoursMap = Record<string, WorkingDay | undefined>;

/**
 * `Intl` hafta kısaltması → veritabanı gün anahtarı.
 * `weekday: "short"` İngilizce ("Mon", "Tue"…) verildiği için sabit bir
 * eşleme kullanılır; yerel dildeki kısaltmalara güvenilmez.
 */
const INTL_DAY_TO_KEY: Record<string, DayKey> = {
  Mon: "pazartesi",
  Tue: "sali",
  Wed: "carsamba",
  Thu: "persembe",
  Fri: "cuma",
  Sat: "cumartesi",
  Sun: "pazar",
};

/** Verilen gün için Türkçe gün anahtarı (örn. "pazartesi"). */
export function dayKeyInTurkey(date: Date): DayKey {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: TURKEY_TIMEZONE,
    weekday: "short",
  }).format(date);
  return INTL_DAY_TO_KEY[short] ?? "pazartesi";
}

/**
 * Verilen an için Türkye yerel saati, gece yarısından dakika cinsinden.
 * "Bugün saat kaç?" sorusunun saat dilimi farkında cevabı.
 */
export function minutesSinceMidnightInTurkey(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TURKEY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  let h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  if (h === 24) h = 0;
  return h * 60 + m;
}

/**
 * Türkiye yerel tarihinin YIL-AY-GÜN bileşenleri.
 * Gece yarısını UTC'ye çevirmek için gerekir (aşağıda `turkeyWallClockToUtc`).
 */
function turkeyDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TURKEY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * Verilen anın, belirtilen zaman dilimindeki UTC farkı (dakika).
 * +3 yaz saati, +0 kış saati. DST geçişlerinde farklı olabilir; hesap her
 * çağrıda o ana göre yapılır.
 */
function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/**
 * Türkiye yerel duvar saati ("bugün 14:30") → UTC anı.
 *
 * Bir günün Türkiye gecesi yarısını UTC'ye çevirmek için iki adım gerekir:
 *  1. Duvar saatini UTC gibi yorumla (`Date.UTC`).
 *  2. O andaki gerçek zaman dilimi farkını çıkar.
 */
export function turkeyWallClockToUtc(
  year: number,
  month: number,
  day: number,
  minutes: number,
): number {
  const naiveUtc = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
  // Fark, "naive" andan bir kez hesaplanır; iki kez uygulanırsa doğru olur
  // (DST geçişlerinde tek uygulama 1 saat kaydırır).
  let ts = naiveUtc;
  for (let i = 0; i < 2; i++) {
    const offset = timezoneOffsetMinutes(new Date(ts), TURKEY_TIMEZONE);
    ts = naiveUtc - offset * 60000;
  }
  return ts;
}

/** "HH:MM" → gece yarısından dakika. Geçersizse null. */
export function toMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Dakikayı "HH:MM" biçimine çevirir. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Dolu zaman aralığı (mutlak UTC ms). */
export interface BusyRange {
  start: number;
  end: number;
  /**
   * Randevunun elemanı. `null` → eleman seçilmeden alınan, işletme genelinde
   * bir randevu; tüm elemanları aynı anda bloke eder.
   */
  staffId: string | null;
}

export interface AvailabilityInput {
  /** İşletmenin haftalık çalışma saatleri. */
  workingHours: WorkingHoursMap | null | undefined;
  /** İşletmenin randevu kuralları (slot aralığı vb.). */
  slotDuration?: number | null;
  /** Aktif hizmetlerin süreleri (dakika). En kısası "bir şey sığar mı" sorusunu belirler. */
  serviceDurations?: number[];
  /** İşletmenin elemanları (profil id'leri). Boşsa eleman kısıtı yok sayılır. */
  staffIds?: string[];
  /** O günkü dolu randevular. */
  busyRanges?: BusyRange[];
  /** "Şu an" referansı. */
  now: Date;
}

export type AvailabilityReason =
  /** İşletme bu gün kapalı. */
  | "closed"
  /** Tanımlı hizmet yok — randevu alınamaz. */
  | "no_services"
  /** Bugün için kalan uygun saat yok (doldu veya dolu). */
  | "fully_booked"
  /** Boş saat var. */
  | "available";

export interface AvailabilityResult {
  /** İşletme bu gün çalışma saatleri içinde mi? */
  isOpen: boolean;
  /** Bugün randevu alınabilecek bir boş slot var mı? */
  hasFreeSlot: boolean
  /** En yakın boş slot ("HH:MM"). Yoksa null. */
  nextSlot: string | null;
  reason: AvailabilityReason;
}

const DEFAULT_SLOT_DURATION = 30;

/**
 * Bir slot aralığı, dolu bir randevuyla çakışıyor mu?
 * Slot [start, end); randevu [busyStart, busyEnd) — uç nokta değil, aralık
 * kesişimi esas alınır (bitiş = başlangıç çakışma sayılmaz).
 */
function conflicts(
  slotStart: number,
  slotEnd: number,
  busy: BusyRange,
): boolean {
  return slotStart < busy.end && slotEnd > busy.start;
}

/**
 * "Bugün müsait" hesabı.
 *
 * Adımlar:
 *  1. Bugünün gününü bul (Türkiye saati) ve işletmenin o günkü saatlerini oku.
 *  2. Slot ızgarasını üret (açılış → kapanış, `slotDuration` adımlarla).
 *  3. Geçmiş slotları ele (bugün için "şu an"dan öncesi seçilemez).
 *  4. Hizmet süresi kapanış saatine sığmayan slotları ele.
 *  5. Dolu randevularla çakışan slotları ele.
 */
export function computeAvailability(
  input: AvailabilityInput,
): AvailabilityResult {
  const {
    workingHours,
    slotDuration,
    serviceDurations = [],
    staffIds = [],
    busyRanges = [],
    now,
  } = input;

  const dayKey = dayKeyInTurkey(now);
  const day = workingHours?.[dayKey];

  // Saat tanımı yoksa sunucunun davranışı: kısıt uygulanmaz (açık sayılır).
  // Tanım varsa ve gün kapalıysa gün boyu kapalı.
  if (day && day.isOpen === false) {
    return {
      isOpen: false,
      hasFreeSlot: false,
      nextSlot: null,
      reason: "closed",
    };
  }

  // Hizmet yoksa randevu alınamaz (sunucu da hizmeti zorunlu kılar).
  if (serviceDurations.length === 0) {
    return {
      isOpen: false,
      hasFreeSlot: false,
      nextSlot: null,
      reason: "no_services",
    };
  }

  const openMin = day ? toMinutes(day.openTime) : null;
  const closeMin = day ? toMinutes(day.closeTime) : null;
  if (openMin === null || closeMin === null) {
    // Saat tanımı eksik → sunucu kısıt uygulamıyor; gün boyu açık sayılır.
    return {
      isOpen: true,
      hasFreeSlot: true,
      nextSlot: null,
      reason: "available",
    };
  }

  const step =
    typeof slotDuration === "number" && slotDuration > 0
      ? slotDuration
      : DEFAULT_SLOT_DURATION;
  // Bir slotun dolu kalması için en az kısa hizmetin sığması gerekir.
  const needed = Math.min(...serviceDurations);
  const nowMinutes = minutesSinceMidnightInTurkey(now);

  const { year, month, day: dayOfMonth } = turkeyDateParts(now);
  // Slot başlangıcının UTC anı (Türkiye duvar saati → UTC).
  const dayStartUtc = turkeyWallClockToUtc(year, month, dayOfMonth, 0);

  let nextSlot: string | null = null;

  for (let m = openMin; m + needed <= closeMin; m += step) {
    // Bugün için geçmiş saatler seçilemez.
    if (m < nowMinutes) continue;

    const slotStart = dayStartUtc + m * 60000;
    const slotEnd = slotStart + needed * 60000;

    // Eleman kısıtı: herhangi BİR eleman bu slotta müsaitse işletme müsait.
    // `staffId: null` olan randevular tüm elemanları aynı anda bloke eder.
    const blocked = busyRanges.filter((b) => {
      if (!conflicts(slotStart, slotEnd, b)) return false;
      if (b.staffId === null) return true;
      // Eleman listesi boşsa (bilgi yok) eleman bazlı engel sayılır.
      if (staffIds.length === 0) return true;
      return staffIds.includes(b.staffId);
    });

    const blockedByStaff = new Set(
      blocked.map((b) => b.staffId).filter((id): id is string => id !== null),
    );
    const blockedForAll = blocked.some((b) => b.staffId === null);
    const allStaffBusy =
      staffIds.length > 0 && blockedByStaff.size >= staffIds.length;

    if (blockedForAll || allStaffBusy) continue;

    nextSlot = formatMinutes(m);
    break;
  }

  if (nextSlot) {
    return { isOpen: true, hasFreeSlot: true, nextSlot, reason: "available" };
  }

  return {
    isOpen: true,
    hasFreeSlot: false,
    nextSlot: null,
    reason: "fully_booked",
  };
}
