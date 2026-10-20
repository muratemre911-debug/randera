import { describe, expect, it } from "vitest";
import {
  digitsOnly,
  hasFakePattern,
  inspectTrMobile,
  isTrMobile,
  normalizeTrMobile,
  trMobileErrorMessage,
} from "./phone";

describe("digitsOnly", () => {
  it("rakam dışı karakterleri atar", () => {
    expect(digitsOnly("+90 (532) 123 45 67")).toBe("905321234567");
    expect(digitsOnly(null)).toBe("");
    expect(digitsOnly("")).toBe("");
  });
});

describe("normalizeTrMobile", () => {
  it("boşluklu, +90'lı ve ülke kodlu yazımları aynı biçime çeker", () => {
    expect(normalizeTrMobile("0532 123 45 67")).toBe("05321234567");
    expect(normalizeTrMobile("+90 532 123 45 67")).toBe("05321234567");
    expect(normalizeTrMobile("905321234567")).toBe("05321234567");
    expect(normalizeTrMobile("0090 532 123 45 67")).toBe("05321234567");
    expect(normalizeTrMobile("5321234567")).toBe("05321234567");
  });

  it("hatalı biçimlerde null döner", () => {
    expect(normalizeTrMobile("")).toBe(null);
    expect(normalizeTrMobile("0532123456")).toBe(null); // 10 hane, 0 ile başlıyor
    expect(normalizeTrMobile("053212345678")).toBe(null); // fazla hane
    expect(normalizeTrMobile("02121234567")).toBe(null); // sabit hat
    expect(normalizeTrMobile("1122334455")).toBe(null);
  });
});

describe("hasFakePattern", () => {
  it("bariz uydurma desenleri yakalar", () => {
    expect(hasFakePattern("05000000000")).toBe(true); // tümü aynı
    expect(hasFakePattern("05511111111")).toBe(true); // bir hane 6+ kez
    expect(hasFakePattern("05123456789")).toBe(true); // art arda dizi
    expect(hasFakePattern("05987654321")).toBe(true); // azalan dizi
    expect(hasFakePattern("05050505050")).toBe(true); // blok tekrarı
  });

  it("gerçek görünen numaraları geçirir", () => {
    expect(hasFakePattern("05321234567")).toBe(false);
    expect(hasFakePattern("05423678901")).toBe(false);
    expect(hasFakePattern("05551112233")).toBe(false);
  });
});

describe("inspectTrMobile", () => {
  it("eksik numarada required döner", () => {
    expect(inspectTrMobile("")).toEqual({ ok: false, issue: "required" });
    expect(inspectTrMobile(null)).toEqual({ ok: false, issue: "required" });
  });

  it("biçim hatalarında format döner", () => {
    expect(inspectTrMobile("123")).toEqual({ ok: false, issue: "format" });
    expect(inspectTrMobile("02121234567")).toEqual({
      ok: false,
      issue: "format",
    });
  });

  it("uydurma desende fake döner", () => {
    expect(inspectTrMobile("05000000000")).toEqual({
      ok: false,
      issue: "fake",
    });
  });

  it("geçerli numarayı normalize ederek döner", () => {
    expect(inspectTrMobile("+90 532 123 45 67")).toEqual({
      ok: true,
      phone: "05321234567",
    });
  });
});

describe("isTrMobile", () => {
  it("tek satırda kontrol sağlar", () => {
    expect(isTrMobile("0532 123 45 67")).toBe(true);
    expect(isTrMobile("5321234567")).toBe(true);
    expect(isTrMobile("0500000000")).toBe(false);
    expect(isTrMobile(null)).toBe(false);
  });
});

describe("trMobileErrorMessage", () => {
  it("dile göre mesaj döner", () => {
    expect(trMobileErrorMessage("fake", "tr")).toContain("benzemiyor");
    expect(trMobileErrorMessage("fake", "en")).toContain("look like");
    expect(trMobileErrorMessage("format", "tr")).toContain("05XX");
    expect(trMobileErrorMessage("format", "en")).toContain("05XX");
  });
});
