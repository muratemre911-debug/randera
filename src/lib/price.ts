/** "300" -> 300, "300,5" -> 300.5; boş/geçersiz/negatif -> null */
export function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Fiyat girilen min/maks aralığına giriyor mu? (boş sınır = sınırsız) */
export function matchesPriceRange(
  price: number,
  min: number | null,
  max: number | null,
): boolean {
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}
