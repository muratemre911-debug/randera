import { describe, expect, it } from "vitest";
import { localDateString, localDateTime } from "./date";

describe("localDateString", () => {
  it("UTC tarihi değil yerel tarihi üretir", () => {
    // 2024-05-13 00:30 TR = 2024-05-12T21:30Z → UTC günü 12, yerel gün 13.
    const lateNight = new Date("2024-05-12T21:30:00Z");
    expect(localDateString(lateNight)).toBe("2024-05-13");
  });

  it("sıfırları iki haneli yazar", () => {
    const earlyJanuary = new Date(2024, 0, 5, 12, 0);
    expect(localDateString(earlyJanuary)).toBe("2024-01-05");
  });
});

describe("localDateTime", () => {
  it("tarih ve saati yerel zamanda birleştirir", () => {
    const result = localDateTime("2024-05-13", "14:30");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(4);
    expect(result!.getDate()).toBe(13);
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it("geçersiz tarih/saat biçiminde null döner", () => {
    expect(localDateTime("13/05/2024", "14:30")).toBeNull();
    expect(localDateTime("2024-05-13", "1430")).toBeNull();
    expect(localDateTime("", "")).toBeNull();
  });
});
