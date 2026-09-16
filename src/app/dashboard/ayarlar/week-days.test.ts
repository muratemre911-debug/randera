import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/dashboard/ayarlar/page.tsx";

/**
 * Çalışma saatleri listesi Pazartesi'den Pazar'a sıralı olmalı.
 * `working_hours` JSONB olduğu için anahtar sırası garanti değil
 * (listeyi olduğu gibi gezmek "cuma, salı, pazar" gibi bir sıra veriyordu).
 */
describe("çalışma saatleri gün sırası", () => {
  const source = readFileSync(PAGE, "utf8");

  it("günleri Pazartesi'den Pazar'a listeler", () => {
    const order = source.match(/const WEEK_DAYS = \[([^\]]+)\]/)?.[1] ?? "";
    const days = [...order.matchAll(/"(\w+)"/g)].map((m) => m[1]);

    expect(days).toEqual([
      "pazartesi",
      "sali",
      "carsamba",
      "persembe",
      "cuma",
      "cumartesi",
      "pazar",
    ]);
  });

  it("haftalık saatleri nesne anahtar sırasına göre değil, bu listeyle render eder", () => {
    expect(source).toContain("{WEEK_DAYS.map((day) => {");
    expect(source).not.toContain("Object.keys(workingHours).map");
    // Gün eksikse varsayılana düşülür (o günün açılamamasını engeller)
    expect(source).toContain("workingHours[day] ?? defaultWorkingHours[day]");
    expect(source).toContain("prev[day] ?? defaultWorkingHours[day]");
  });
});
