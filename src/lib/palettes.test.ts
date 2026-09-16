import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE_ID,
  PALETTES,
  getPalette,
  paletteCss,
} from "./palettes";

const ROLES = [
  "brand",
  "brandStrong",
  "brandSoft",
  "brandSoftHover",
  "brandText",
  "brandBorder",
] as const;

describe("palettes", () => {
  it("çok sayıda palet ve her birinde açık + koyu varyant var", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(20);
    for (const p of PALETTES) {
      expect(p.name.length).toBeGreaterThan(2);
      for (const mode of ["light", "dark"] as const) {
        for (const role of ROLES) {
          expect(p[mode][role], `${p.id}.${mode}.${role}`).toMatch(
            /^(oklch|#|rgb)/,
          );
        }
      }
      // Açık ve koyu varyantlar gerçekten farklı olmalı
      expect(p.light.brand).not.toBe(p.dark.brand);
    }
  });

  it("palet id leri benzersiz", () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_PALETTE_ID);
  });

  it("bilinmeyen/boş id varsayılan palete düşer", () => {
    expect(getPalette("rose").id).toBe("rose");
    expect(getPalette("boyle-bir-palet-yok").id).toBe(DEFAULT_PALETTE_ID);
    expect(getPalette(null).id).toBe(DEFAULT_PALETTE_ID);
  });

  it("css hem açık hem koyu hem de önizleme (force) kurallarını üretir", () => {
    const css = paletteCss(getPalette("emerald"));
    expect(css).toContain(".brand-scope{");
    expect(css).toContain(".dark .brand-scope,.brand-scope.dark{");
    expect(css).toContain(".brand-scope.force-light{");
    expect(css).toContain(".brand-scope.force-dark{");
    expect(css).toContain(getPalette("emerald").light.brand);
    expect(css).toContain(getPalette("emerald").dark.brand);
    expect(css).toContain("--brand-shadow:color-mix");
  });
});
