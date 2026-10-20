/**
 * Tarih yardımcıları.
 *
 * `toISOString()` UTC tarihi verir. Türkiye UTC+3 olduğu için, gece yarısını
 * geçen saatlerde `toISOString().split("T")[0]` bir gün ÖNCEKİ tarihi
 * döndürür. Bu, "bugünün randevusunu ekle" gibi varsayılan tarih atayan
 * ekranlarda randevunun yanlış güne düşmesine yol açıyordu.
 *
 * Buradaki yardımcılar daima tarayıcının YEREL takvim gününü üretir; aynı
 * değer `new Date(y, m-1, d)` ile tüketildiği için iki taraf da aynı güne
 * düşer.
 */

/** Yerel takvimde bugünün tarihi → "YYYY-MM-DD". */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "YYYY-MM-DD" + "HH:MM" → yerel zamanda Date.
 * Geçersiz girdide null döner (çağıran taraf doğrulama yapabilir).
 */
export function localDateTime(
  dateString: string,
  timeString: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeString.trim());
  if (!dateMatch || !timeMatch) return null;

  const [, y, m, d] = dateMatch;
  const [, hh, mm] = timeMatch;

  const result = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
  );
  if (Number.isNaN(result.getTime())) return null;
  return result;
}
