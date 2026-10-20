/**
 * Çeviri sözlüğü — ortak yapı.
 *
 * Bu dosya "sözlük parçalarını" birleştirir. Neden?: Birden fazla geliştirici
 * (veya ajan) aynı dosyaya eşzamanlı anahtar ekleyince birbirinin
 * işini ezebiliyordu. Artık her alan kendi dosyasında (`src/locales/parts/`)
 * tanımlanıyor ve burada birleştiriliyor.
 *
 * Yeni alan eklemek için:
 *  1. `src/locales/parts/<alan>.ts` dosyası oluştur ve `tr`/`en` sözlüklerini dışa aktar.
 *  2. Aşağıdaki `parts` listesine ekle.
 *
 * Anahtar adlandırma kuralı: `<alan>.<bölüm>.<ad>` — örn. `musteriler.title`.
 */

import { commonTr, commonEn } from "./parts/common";
import { dashboardTr, dashboardEn } from "./parts/dashboard";
import { adminTr, adminEn } from "./parts/admin";

/**
 * Türkçe sözlük parçaları.
 *
 * NOT: Bir alan için parça dosyası henüz yoksa o alanın çevirileri
 * `common.ts` içinde ya da doğrudan `commonTr`/`commonEn` sözlüğünde
 * bulunur. Yeni alan eklerken `parts/<alan>.ts` oluştur ve buraya ekle.
 */
const trParts: Record<string, string>[] = [
  commonTr,
  dashboardTr,
  adminTr,
];

/** İngilizce sözlük parçaları. */
const enParts: Record<string, string>[] = [
  commonEn,
  dashboardEn,
  adminEn,
];

function merge(parts: Record<string, string>[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      // Aynı anahtar iki parçada varsa sessizce ezmek yerine hata ver:
      // çakışma, iki kişinin aynı işi yapması demektir.
      if (key in result) {
        throw new Error(
          `Çeviri anahtarı çakışması: "${key}". ` +
            `Her anahtar yalnızca bir parçada tanımlanmalı.`,
        );
      }
      result[key] = value;
    }
  }
  return result;
}

export const tr = merge(trParts);
export const en = merge(enParts);
