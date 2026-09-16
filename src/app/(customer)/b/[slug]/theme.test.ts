import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/(customer)/b/[slug]/page.tsx";
// Randevu alma ekranı da işletmenin paletini kullanmalı (aynı akış, ayrı sayfa)
const BOOKING_PAGE = "src/app/(customer)/b/[slug]/randevu/page.tsx";
// İşletme sayfası ve randevu ekranı içinde render edilen, paleti takip etmesi
// gereken bileşenler
const SCOPED_COMPONENTS = [
  "src/components/ReviewModal.tsx",
  "src/components/ManageReviewsModal.tsx",
  "src/components/PostModal.tsx",
  "src/components/RequirePhoneModal.tsx",
];

describe("işletme sayfası tema paleti", () => {
  const source = readFileSync(PAGE, "utf8");

  it("vurgu renkleri sabit kodlanmış indigo yerine palet değişkenlerini kullanır", () => {
    expect(source).not.toMatch(/indigo-\d/);
    expect(source).toContain("brand-scope");
    expect(source).toContain("bg-[var(--brand)]");
    expect(source).toContain("bg-[var(--brand-soft)]");
  });

  it("işletmenin seçtiği paleti uygular", () => {
    expect(source).toContain("paletteCss(getPalette(tenant.theme_palette))");
  });

  it("işletme sayfasındaki modallar da palet değişkenlerini kullanır", () => {
    for (const file of SCOPED_COMPONENTS) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/indigo-\d/);
      expect(src, file).toMatch(/var\(--brand/);
    }
  });

  it("randevu alma ekranı da işletmenin paletini uygular", () => {
    const booking = readFileSync(BOOKING_PAGE, "utf8");

    expect(booking).not.toMatch(/indigo-\d/);
    expect(booking).toContain("brand-scope");
    expect(booking).toContain("paletteCss(getPalette(tenant?.theme_palette))");
    expect(booking).toContain("bg-[var(--brand)]");
    // palet her dönüş dalına (yükleniyor / hata / başarı / form) uygulanmalı
    const roots = booking.match(/className="brand-scope/g) ?? [];
    const branches = booking.match(/^ {2,6}return \($/gm) ?? [];
    expect(branches).toHaveLength(4);
    expect(roots).toHaveLength(branches.length);
  });
});
