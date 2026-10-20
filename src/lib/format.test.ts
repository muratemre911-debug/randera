import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumber, buildWhatsAppUrl } from "./format";

describe("formatNumber", () => {
  it("Türkçe dilinde binlik ayırıcı kullanır", () => {
    expect(formatNumber(1250, "tr")).toBe("1.250");
  });

  it("İngilizce dilinde virgül ayırıcı kullanır", () => {
    expect(formatNumber(1250, "en")).toBe("1,250");
  });
});

describe("formatCurrency", () => {
  it("Türkçede ₺ işareti ve nokta ayırıcı kullanır", () => {
    const out = formatCurrency(1250, "tr");
    expect(out).toContain("₺");
    expect(out).toContain("1.250");
  });

  it("İngilizcede virgül ayırıcı kullanır", () => {
    const out = formatCurrency(1250, "en");
    expect(out).toContain("1,250");
  });

  it("ondalık basamak göstermez", () => {
    expect(formatCurrency(1250.75, "tr")).not.toContain(",");
  });
});

describe("buildWhatsAppUrl", () => {
  it("05 ile başlayan numarayı 90 ile tamamlar", () => {
    expect(buildWhatsAppUrl("05551234567", "merhaba")).toContain(
      "wa.me/905551234567",
    );
  });

  it("5 ile başlayan numarayı 90 ile tamamlar", () => {
    expect(buildWhatsAppUrl("5551234567", "merhaba")).toContain(
      "wa.me/905551234567",
    );
  });

  it("zaten 90 ile başlayan numarayı değiştirmez", () => {
    expect(buildWhatsAppUrl("905551234567", "merhaba")).toContain(
      "wa.me/905551234567",
    );
  });

  it("+90 ve boşluk içeren numarayı temizler", () => {
    expect(buildWhatsAppUrl("+90 555 123 45 67", "x")).toContain(
      "wa.me/905551234567",
    );
  });

  it("metni URL-kodlar", () => {
    const url = buildWhatsAppUrl("05551234567", "merhaba dünya")!;
    expect(url).toContain("text=");
    expect(url).toContain("%C3%BC");
  });

  it("numara yoksa null döner", () => {
    expect(buildWhatsAppUrl(null, "x")).toBeNull();
    expect(buildWhatsAppUrl("", "x")).toBeNull();
    expect(buildWhatsAppUrl("abc", "x")).toBeNull();
  });
});
