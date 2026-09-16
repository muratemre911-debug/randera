import { describe, expect, it } from "vitest";
import { matchesPriceRange, parsePrice } from "./price";

describe("parsePrice", () => {
  it("geçerli sayıyı çevirir, boş/geçersiz/negatifi null yapar", () => {
    expect(parsePrice("300")).toBe(300);
    expect(parsePrice(" 250 ")).toBe(250);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
  });
});

describe("matchesPriceRange", () => {
  it("boş sınırları sınırsız sayar", () => {
    expect(matchesPriceRange(500, null, null)).toBe(true);
  });

  it("min ve maks sınırlarını uygular", () => {
    expect(matchesPriceRange(300, 300, 600)).toBe(true);
    expect(matchesPriceRange(299, 300, null)).toBe(false);
    expect(matchesPriceRange(601, null, 600)).toBe(false);
    // sadece min girilirse üst sınır yok
    expect(matchesPriceRange(5000, 400, null)).toBe(true);
  });
});
