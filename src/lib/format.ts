/**
 * Biçimlendirme yardımcıları.
 *
 * Neden ayrı dosya: para birimi biçimlendirme `toLocaleString("tr-TR")`
 * olarak 7 ayrı yerde SABİT yazılmıştı. EN kullanıcısına da Türkçe sayı
 * biçimi (ondalık ayırıcı virgül) gösteriliyordu. Artık dil parametresi
 * üzerinden doğru yerel biçim kullanılıyor.
 */

/** Uygulamanın desteklediği diller. */
export type AppLang = "tr" | "en";

/** Dil → BCP 47 yerel ayar etiketi. */
const LOCALE: Record<AppLang, string> = {
  tr: "tr-TR",
  en: "en-US",
};

/** Sayıyı dile uygun biçimde gösterir (binlik ayırıcı, ondalık). */
export function formatNumber(
  value: number,
  lang: AppLang = "tr",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALE[lang], options).format(value);
}

/** Para birimini dile uygun biçimde gösterir (₺1.250,00 / ₺1,250.00). */
export function formatCurrency(
  value: number,
  lang: AppLang = "tr",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

/**
 * WhatsApp bağlantısı üretir.
 *
 * Neden ayrı: numara normalizasyonu (baştaki 0, +90, 90) 4 ayrı yerde
 * kopyalanmıştı ve bir yerde `90555` gibi hatalı sonuç üretiyordu.
 *
 * @param phone Telefon numarası (boşsa null döner).
 * @param message Gönderilecek metin.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Türkiye numarası: 05XX… → 905XX…, 5XX… → 905XX…, 90… → 90…
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  else if (digits.startsWith("90")) digits = digits;
  else if (digits.startsWith("5")) digits = `90${digits}`;
  else if (digits.length === 10) digits = `90${digits}`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
