/**
 * Ekip / eleman (staff) yardımcıları.
 *
 * Roller: owner = işletme sahibi, staff = davetle ekibe katılan eleman.
 * Hizmetler `services.staff_id` ile bir ekip üyesine bağlanır.
 */

export interface StaffMember {
 id: string;
 full_name: string | null;
 avatar_url?: string | null;
 role: string;
}

export function isOwnerRole(role?: string | null): boolean {
 return role === "owner";
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
