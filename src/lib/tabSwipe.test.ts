import { describe, expect, it } from "vitest";
import { settledTabIndex } from "./tabSwipe";

describe("settledTabIndex", () => {
  const w = 375;

  it("tam oturan sayfanın indeksini döner", () => {
    expect(settledTabIndex(0, w, 4)).toBe(0);
    expect(settledTabIndex(w * 2, w, 4)).toBe(2);
    expect(settledTabIndex(w * 2 + 3, w, 4)).toBe(2);
  });

  it("sayfaların arasında kalırken null döner", () => {
    expect(settledTabIndex(w * 1.5, w, 4)).toBeNull();
    expect(settledTabIndex(w * 0.5, w, 4)).toBeNull();
  });

  it("aralık dışını ve geçersiz genişliği yok sayar", () => {
    expect(settledTabIndex(w * 4, w, 4)).toBeNull();
    expect(settledTabIndex(-12, w, 4)).toBeNull();
    expect(settledTabIndex(0, 0, 4)).toBeNull();
  });
});
