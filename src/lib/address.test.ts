import { describe, expect, it } from "vitest";
import { buildAddressQuery, formatFullAddress } from "./address";

describe("address helpers", () => {
  const tenant = {
    province: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Caferağa",
    street: "Moda Caddesi",
    building_no: "12/A",
    address: "Kat 2, asansör karşısı",
  };

  it("yapılandırılmış adresi okunur biçimde birleştirir", () => {
    expect(formatFullAddress(tenant)).toBe(
      "Caferağa Moda Caddesi 12/A, Kadıköy/İstanbul",
    );
  });

  it("eksik alanlarda boş parça bırakmaz", () => {
    expect(formatFullAddress({ province: "Ankara", district: "Çankaya" })).toBe(
      "Çankaya/Ankara",
    );
    expect(formatFullAddress({})).toBe("");
  });

  it("Nominatim sorgusu için mahalle ekini ve il/ilçeyi ekler", () => {
    expect(buildAddressQuery(tenant)).toBe(
      "Caferağa Mahallesi, Moda Caddesi, 12/A, Kadıköy, İstanbul",
    );
  });
});
