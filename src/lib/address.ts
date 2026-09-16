export interface StructuredAddress {
  province?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  building_no?: string | null;
  address?: string | null;
}

/** Yapılandırılmış adres alanlarını "Mahalle, Sokak No, İlçe/İl" biçiminde birleştirir. */
export function formatFullAddress(a: StructuredAddress): string {
  const line = [a.neighborhood, a.street, a.building_no]
    .filter(Boolean)
    .join(" ");
  const place = [a.district, a.province].filter(Boolean).join("/");
  return [line, place].filter(Boolean).join(", ");
}

/** Nominatim adres sorgusu için alanları birleştirir. */
export function buildAddressQuery(a: StructuredAddress): string {
  return [
    a.neighborhood ? `${a.neighborhood} Mahallesi` : "",
    a.street,
    a.building_no,
    a.district,
    a.province,
  ]
    .filter(Boolean)
    .join(", ");
}
