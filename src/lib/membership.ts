export type MembershipStatus = "trial" | "active" | "unlimited" | "suspended";

export interface MembershipInfo {
 /** trial | active | unlimited | expired | suspended */
 kind: "trial" | "active" | "unlimited" | "expired" | "suspended";
 /** Kalan gün (bitmişse 0, sınırsızda 0) */
 daysLeft: number;
 /** Geçerli bitiş tarihi (ISO) — sınırsızda null */
 endsAt: string | null;
}

export interface MembershipRow {
 membership_status?: string | null;
 trial_ends_at?: string | null;
 membership_ends_at?: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Bitiş tarihine kalan tam gün sayısı (yukarı yuvarlanır, bitmişse 0). */
export function remainingDays(
 endsAt: string | null | undefined,
 now: Date = new Date(),
): number {
 if (!endsAt) return 0;
 const diff = new Date(endsAt).getTime() - now.getTime();
 return diff <= 0 ? 0 : Math.ceil(diff / DAY);
}

/** Süper admin işletmesi mi (sınırsız üyelik)? */
export function isUnlimitedStatus(
 row: MembershipRow | null | undefined,
): boolean {
 return row?.membership_status === "unlimited";
}

/**
 * İşletmenin üyelik durumunu hesaplar.
 * Sınırsız (süper admin) ve kapalı (suspended) durumlar önceliklidir; aksi halde
 * ücretli üyelik > deneme sırasıyla bakılır.
 */
export function getMembership(
 row: MembershipRow,
 now: Date = new Date(),
): MembershipInfo {
 if (isUnlimitedStatus(row)) {
  return { kind: "unlimited", daysLeft: 0, endsAt: null };
 }

 if (row.membership_status === "suspended") {
  return {
   kind: "suspended",
   daysLeft: 0,
   endsAt: row.membership_ends_at ?? null,
  };
 }

 const membershipDays = remainingDays(row.membership_ends_at, now);
 if (membershipDays > 0) {
  return {
   kind: "active",
   daysLeft: membershipDays,
   endsAt: row.membership_ends_at ?? null,
  };
 }

 const trialDays = remainingDays(row.trial_ends_at, now);
 if (trialDays > 0) {
  return {
   kind: "trial",
   daysLeft: trialDays,
   endsAt: row.trial_ends_at ?? null,
  };
 }

 return {
  kind: "expired",
  daysLeft: 0,
  endsAt: row.membership_ends_at ?? row.trial_ends_at ?? null,
 };
}

export function isMembershipOpen(
 row: MembershipRow,
 now: Date = new Date(),
): boolean {
 const info = getMembership(row, now);
 return (
  info.kind === "trial" || info.kind === "active" || info.kind === "unlimited"
 );
}

/**
 * İşletme keşfette listelenmeli mi?
 * Üyelik bilgisi hiç yoksa (kolonlar boş/eski kayıt) gizlenmez.
 */
export function isDiscoverable(
 row: MembershipRow,
 now: Date = new Date(),
): boolean {
 if (!row.membership_status && !row.trial_ends_at && !row.membership_ends_at)
  return true;
 return isMembershipOpen(row, now);
}

/**
 * Süre yükleme/düşürme: mevcut bitiş tarihinin üzerine ekler.
 * Süresi geçmişse bugünden başlar. days negatif olabilir (süre düşürme).
 */
export function shiftEndDate(
 currentEnd: string | null | undefined,
 days: number,
 now: Date = new Date(),
): string {
 const current = currentEnd ? new Date(currentEnd) : null;
 const base = current && current.getTime() > now.getTime() ? current : now;
 return new Date(base.getTime() + days * DAY).toISOString();
}

/** "14 gün deneme" / "1 aylık üyelik" kısayolları için gün sayıları */
export const TRIAL_DAYS = 14;
export const MONTHLY_DAYS = 30;

export function formatRemaining(
 info: MembershipInfo,
 lang: "tr" | "en" = "tr",
): string {
 if (info.kind === "unlimited") {
  return lang === "tr" ? "Sınırsız üyelik" : "Unlimited membership";
 }
 if (info.kind === "suspended")
  return lang === "tr" ? "Üyelik kapalı" : "Membership closed";
 if (info.kind === "expired")
  return lang === "tr" ? "Üyelik süresi doldu" : "Membership expired";

 const labels = {
  trial: { tr: "deneme", en: "trial" },
  active: { tr: "üyelik", en: "membership" },
 } as const;
 const label = labels[info.kind === "trial" ? "trial" : "active"][lang];

 return lang === "tr"
  ? `${info.daysLeft} gün ${label} kaldı`
  : `${info.daysLeft} days ${label} left`;
}
