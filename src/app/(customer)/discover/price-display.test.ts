import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Hizmeti/fiyatı olmayan işletmeler için uydurma fiyat üretilmemeli.
 * (Eskiden id hash'inden 250-500 ₺ arası sahte "başlangıç fiyatı" gösteriliyordu.)
 */
const SOURCES = [
  "src/app/(customer)/discover/page.tsx",
  "src/app/(customer)/favorites/page.tsx",
  "src/components/discover/DiscoverMap.tsx",
];

describe("fiyat gösterimi", () => {
  it("hiçbir sayfa hash tabanlı sahte fiyat üretmez", () => {
    for (const file of SOURCES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/hash\s*%\s*6/);
      expect(src, file).not.toMatch(/250 \+ \(hash/);
    }
  });

  it("fiyat bilinmediğinde nötr metin gösterilir", () => {
    const discover = readFileSync(SOURCES[0], "utf8");
    const favorites = readFileSync(SOURCES[1], "utf8");
    const map = readFileSync(SOURCES[2], "utf8");

    expect(discover).toContain("Fiyat bilgisi yok");
    expect(favorites).toContain("Fiyat bilgisi yok");
    expect(map).toContain("Fiyat bilgisi yok");
    // fiyat yokken pinlerde işletme adı gösterilir
    expect(map).toContain(
      "pinHtml(getTenantPrice(tenant), isSelected, tenant.name)",
    );
  });
});
