/**
 * Ekip / eleman (staff) yardımcıları.
 *
 * Roller: owner = işletme sahibi, staff = davetle ekibe katılan eleman.
 * Hizmetler `services.staff_id` ile bir ekip üyesine bağlanır.
 */

export interface WorkingDayInfo {
 isOpen: boolean;
 openTime: string;
 closeTime: string;
}

export type WorkingHoursMap = Record<string, WorkingDayInfo>;

/**
 * Randevu kuralları. İşletme geneli (tenants.booking_rules) ve elemana özel
 * (staff_settings.booking_rules) aynı biçimde saklanır. Veritabanındaki JSONB
 * kısmi olabileceği için çözümlenmiş hali tam (required) tutulur.
 */
export interface BookingRules {
 slotDuration: number;
 autoApprove: boolean;
 notifyEmail: boolean;
 notifySms: boolean;
 notifyWhatsapp: boolean;
 cancelDeadlineHours: number;
}

/** Veritabanında saklanan kısmi kural seti. */
export type BookingRulesInput = Partial<BookingRules>;

/** Hiçbir ayar yapılmamışsa geçerli olan varsayılanlar. */
export const DEFAULT_BOOKING_RULES: BookingRules = {
 slotDuration: 30,
 autoApprove: true,
 notifyEmail: true,
 notifySms: false,
 notifyWhatsapp: false,
 cancelDeadlineHours: 24,
};

export interface StaffMember {
 id: string;
 full_name: string | null;
 avatar_url?: string | null;
 role: string;
 /**
  * Elemanın kendi seçtiği aktif saatler (staff_settings.working_hours).
  * Boş ise işletme saatleri (tenants.working_hours) geçerlidir.
  */
 working_hours?: WorkingHoursMap | null;
 /**
  * Elemana özel randevu kuralları (staff_settings.booking_rules).
  * Boş bıraktığı alanlarda işletme kuralları geçerlidir.
  */
 booking_rules?: BookingRulesInput | null;
}

/**
 * Elemana özel kuralları işletme kurallarıyla birleştirir.
 *
 * Alan bazlıdır: elemanın doldurduğu alan onun, boş bıraktığı alan işletmenin
 * değerini alır. İkisi de yoksa varsayılana düşer.
 */
export function effectiveBookingRules(
 staffRules: BookingRulesInput | null | undefined,
 tenantRules: BookingRulesInput | null | undefined,
): BookingRules {
 const pick = <K extends keyof BookingRules>(key: K): BookingRules[K] =>
  staffRules?.[key] ?? tenantRules?.[key] ?? DEFAULT_BOOKING_RULES[key];

 return {
  slotDuration: pick("slotDuration"),
  autoApprove: pick("autoApprove"),
  notifyEmail: pick("notifyEmail"),
  notifySms: pick("notifySms"),
  notifyWhatsapp: pick("notifyWhatsapp"),
  cancelDeadlineHours: pick("cancelDeadlineHours"),
 };
}

/**
 * Seçilen eleman + işletme saatlerinden o gün için GEÇERLİ olanı bulur.
 *
 * Kural gün bazlıdır: eleman o gün için saat girdiyse onunki, girmediyse
 * işletmeninki uygulanır. Eleman bir günü "kapalı" işaretleyerek işletme
 * açık olsa bile o gün randevu almayı kapatabilir.
 */
export function effectiveDayHours(
 staffHours: WorkingHoursMap | null | undefined,
 tenantHours: WorkingHoursMap | null | undefined,
 day: string,
): WorkingDayInfo | null {
 const staffDay = staffHours?.[day];
 if (staffDay) return staffDay;
 return tenantHours?.[day] ?? null;
}

export function isOwnerRole(role?: string | null): boolean {
 return role === "owner";
}

/**
 * Elemanın görebileceği kayıtların kapsamı.
 *
 * Eleman yalnızca KENDİ kayıtlarını görür ve yönetir (kendi randevuları ve o
 * randevulardaki müşteriler); işletme sahibi tüm işletmeyi görür. Sorgulara
 * eklenecek `staff_id` filtresini döner; sahip için `null` (filtre yok).
 */
export function ownRecordsScope(
 role: string | null | undefined,
 userId: string,
): string | null {
 return role === "owner" ? null : userId;
}

/** İşletme sahibi ekibin en üstünde gösterilir (müşteri tarafında vurgulanır). */
export function sortStaffOwnerFirst<T extends { role: string }>(
 list: T[],
): T[] {
 return [...list].sort((a, b) => {
  if (a.role === b.role) return 0;
  if (a.role === "owner") return -1;
  if (b.role === "owner") return 1;
  return 0;
 });
}

export function staffDisplayName(
 member: StaffMember,
 fallback = "İşletme",
): string {
 return member.full_name?.trim() || fallback;
}

/** Davet linkini WhatsApp paylaşımına çevirir (uygulama varsa doğrudan açar). */
export function buildWhatsAppInviteUrl(
 link: string,
 businessName: string,
): string {
 const text =
  `${businessName} ekibine davet edildiniz! ` +
  `Randera üzerinden hizmetlerinizi ve randevularınızı yönetmek için bağlantıya dokunun:\n${link}`;
 return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Seçilen elemanın verebileceği hizmetler.
 * staff_id boş olan hizmetler (migration öncesi kayıtlar) her elemanda görünür,
 * aksi halde hizmet yalnızca sahibinde listelenir.
 */
export function servicesForStaff<T extends { staff_id?: string | null }>(
 services: T[],
 staffId: string | null | undefined,
): T[] {
 if (!staffId) return services;
 return services.filter((s) => !s.staff_id || s.staff_id === staffId);
}
