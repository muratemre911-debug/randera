import { describe, expect, it } from "vitest";
import {
  PROVINCE_COORDS,
  TURKEY_CENTER,
  hasExactLocation,
  tenantCoords,
} from "./provinceCoords";

describe("tenantCoords", () => {
  it("81 il için koordinat tanımlı", () => {
    expect(Object.keys(PROVINCE_COORDS)).toHaveLength(81);
  });

  it("işletmenin haritada seçtiği nokta varsa onu kullanır", () => {
    expect(
      tenantCoords({
        id: "a",
        province: "İstanbul",
        latitude: 41.05,
        longitude: 29.02,
      }),
    ).toEqual([41.05, 29.02]);
    expect(hasExactLocation({ latitude: 41.05, longitude: 29.02 })).toBe(true);
    expect(hasExactLocation({ latitude: 41.05, longitude: null })).toBe(false);
  });

  it("konum seçilmemişse il merkezine yakın (<=7km) ve deterministik bir nokta döner", () => {
    const [lat, lng] = tenantCoords({ id: "tenant-abc", province: "İstanbul" });
    const base = PROVINCE_COORDS["İstanbul"];
    expect(Math.abs(lat - base.lat)).toBeLessThan(0.06);
    expect(Math.abs(lng - base.lng)).toBeLessThan(0.06);
    expect(tenantCoords({ id: "tenant-abc", province: "İstanbul" })).toEqual([
      lat,
      lng,
    ]);
    expect(
      tenantCoords({ id: "tenant-xyz", province: "İstanbul" }),
    ).not.toEqual([lat, lng]);
  });

  it("bilinmeyen/boş il için Türkiye merkezini döner", () => {
    expect(tenantCoords({ id: "t1", province: null })).toEqual(TURKEY_CENTER);
    expect(tenantCoords({ id: "t1", province: "Yok Böyle İl" })).toEqual(
      TURKEY_CENTER,
    );
  });
});
