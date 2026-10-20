/**
 * Türkiye mobil numarası doğrulama ve normalizasyonu.
 *
 * Neden gerekli: kayıt formu numarayı yalnızca "10–13 hane mi" diye kontrol
 * ediyordu; bu yüzden rastgele bir sayı dizisi (örn. 0500000000) gerçek numara
 * gibi kaydediliyor ve işletme müşteriye ulaşamıyordu.
 *
 * Buradaki kontroller numaranın GERÇEKTEN o kişiye ait olduğunu kanıtlamaz —
 * bunun için SMS ile kod (OTP) doğrulaması gerekir. Bu modül yalnızca:
 *   1. numarayı tek biçime çevirir (05XXXXXXXXX),
 *   2. bariz uydurma desenleri eler,
 *   3. aynı numaranın farklı yazımlarını (90..., +90..., 5XX..., boşluklu)
 *      eşitler; böylece "bir numara = bir hesap" kuralı tutarlı işler.
 */

export type PhoneIssue = "required" | "format" | "fake";

export type PhoneCheck =
  | { ok: true; phone: string }
  | { ok: false; issue: PhoneIssue };

export const TR_MOBILE_PLACEHOLDER = "05XX XXX XX XX";

/** Numaradan rakam dışı her şeyi atar. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Numarayı 11 haneli `05XXXXXXXXX` biçimine çevirir.
 * Çevrilemiyorsa (eksik/fazla hane ya da mobil aralık dışı) `null` döner.
 */
export function normalizeTrMobile(
  value: string | null | undefined,
): string | null {
  let digits = digitsOnly(value);

  // +90 5XX... / 90 5XX... / 0090 5XX...
  if (digits.startsWith("90") && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0090") && digits.length === 14) {
    digits = digits.slice(4);
  }

  // 5XX XXX XX XX (baştaki 0 unutulmuş)
  if (digits.length === 10 && digits.startsWith("5")) {
    digits = `0${digits}`;
  }

  if (digits.length !== 11 || !digits.startsWith("05")) return null;
  return digits;
}

/** Art arda gelen hane dizisi mi? (0512345678 / 0598765432 gibi) */
function isSequence(body: string): boolean {
  let ascending = true;
  let descending = true;
  for (let i = 1; i < body.length; i += 1) {
    const diff = body.charCodeAt(i) - body.charCodeAt(i - 1);
    if (diff !== 1) ascending = false;
    if (diff !== -1) descending = false;
  }
  return ascending || descending;
}

/** Aynı kısa bloğun tekrarı mı? (05050505050 gibi) */
function isRepeatedBlock(value: string): boolean {
  for (const size of [1, 2, 3, 4, 5]) {
    if (size === value.length || value.length % size !== 0) continue;
    if (value.slice(0, size).repeat(value.length / size) === value) return true;
  }
  return false;
}

/**
 * Uydurma numaralara özgü desenler. 11 haneli normalize numaranın
 * "05" sonrası 9 hanesi (body) ve son 10 hanesi (tail) incelenir:
 *   - tüm haneler aynı        → 05500000000
 *   - art arda giden dizi     → 05123456789
 *   - aynı bloğun tekrarı     → 05050505050
 *   - bir hane 6+ kez geçiyor → 05511111111
 */
export function hasFakePattern(phone: string): boolean {
  const body = phone.slice(2);
  const tail = phone.slice(1);
  if (!body) return true;
  if (/^(\d)\1+$/.test(body)) return true;
  if (isSequence(body)) return true;
  if (isRepeatedBlock(body) || isRepeatedBlock(tail)) return true;

  const counts = new Map<string, number>();
  for (const digit of body) {
    counts.set(digit, (counts.get(digit) ?? 0) + 1);
  }
  return Math.max(...counts.values()) >= 6;
}

/**
 * Numarayı doğrular ve normal biçimini döner.
 * `inspectTrMobile("0532 123 45 67").phone === "05321234567"`
 */
export function inspectTrMobile(value: string | null | undefined): PhoneCheck {
  if (!digitsOnly(value)) return { ok: false, issue: "required" };

  const phone = normalizeTrMobile(value);
  if (!phone) return { ok: false, issue: "format" };

  if (hasFakePattern(phone)) return { ok: false, issue: "fake" };

  return { ok: true, phone };
}

/** Hızlı kontrol: numara geçerli bir Türkiye mobil numarası mı? */
export function isTrMobile(value: string | null | undefined): boolean {
  return inspectTrMobile(value).ok;
}

/** Kontrol sonucunu kullanıcıya gösterilecek mesaja çevirir. */
export function trMobileErrorMessage(
  issue: PhoneIssue,
  lang: "tr" | "en" = "tr",
): string {
  const messages: Record<"tr" | "en", Record<PhoneIssue, string>> = {
    tr: {
      required: "Lütfen telefon numaranızı girin.",
      format: `Lütfen geçerli bir telefon numarası girin (Örn: ${TR_MOBILE_PLACEHOLDER}).`,
      fake: "Bu numara gerçek bir telefon numarasına benzemiyor. Lütfen kendi numaranızı girin.",
    },
    en: {
      required: "Please enter your phone number.",
      format: `Please enter a valid phone number (e.g. ${TR_MOBILE_PLACEHOLDER}).`,
      fake: "This does not look like a real phone number. Please enter your own number.",
    },
  };

  return messages[lang][issue];
}
