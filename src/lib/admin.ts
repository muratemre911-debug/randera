/**
 * Süper admin erişimi.
 * Sabit olarak yalnızca sistem sahibi girer; istenirse .env.local içindeki
 * NEXT_PUBLIC_SUPER_ADMIN_EMAILS (virgülle ayrılmış) listesi ek yetkili tanımlar.
 * Gerçek yetki kontrolü her API isteğinde sunucu tarafında isSuperAdmin ile yapılır.
 */
const OWNER_EMAIL = "muratemre911@gmail.com";

export const SUPER_ADMIN_EMAILS: string[] = Array.from(
 new Set([
  OWNER_EMAIL,
  ...(process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "")
   .split(",")
   .map((s) => s.trim().toLowerCase())
   .filter(Boolean),
 ]),
);

export function getSuperAdminEmails(): string[] {
 return SUPER_ADMIN_EMAILS;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
 if (!email) return false;
 return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
