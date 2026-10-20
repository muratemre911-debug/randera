import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  dayKeyInTurkey,
  formatMinutes,
  minutesSinceMidnightInTurkey,
  toMinutes,
  turkeyWallClockToUtc,
  type BusyRange,
  type WorkingHoursMap,
} from "./availability";

/** İşletme saatleri: hafta içi 09:00-18:00, pazar kapalı. */
const HOURS: WorkingHoursMap = {
  pazartesi: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  sali: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  carsamba: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  persembe: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  cuma: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  cumartesi: { isOpen: true, openTime: "10:00", closeTime: "16:00" },
  pazar: { isOpen: false, openTime: "00:00", closeTime: "00:00" },
};

/** 2024-05-13 bir PAZARTESİ (TR saatiyle de pazartesi). */
const MONDAY_MORNING = new Date("2024-05-13T09:00:00+03:00");
const MONDAY_NOON = new Date("2024-05-13T12:00:00+03:00");
const MONDAY_EVENING = new Date("2024-05-13T17:30:00+03:00");
/** Kapanışa yetmeyecek kadar geç: 17:45 + 30dk > 18:00. */
const MONDAY_TOO_LATE = new Date("2024-05-13T17:45:00+03:00");
/** 2024-05-12 bir PAZAR. */
const SUNDAY = new Date("2024-05-12T12:00:00+03:00");

const base = {
  workingHours: HOURS,
  slotDuration: 30,
  serviceDurations: [30],
  staffIds: ["staff-1"],
  busyRanges: [] as BusyRange[],
};

describe("availability yardımcıları", () => {
  it("Türkiye gün anahtarını doğru üretir", () => {
    expect(dayKeyInTurkey(MONDAY_MORNING)).toBe("pazartesi");
    expect(dayKeyInTurkey(SUNDAY)).toBe("pazar");
  });

  it("gece yarısından dakikayı Türkiye saatine göre hesaplar", () => {
    expect(minutesSinceMidnightInTurkey(MONDAY_MORNING)).toBe(9 * 60);
    expect(minutesSinceMidnightInTurkey(MONDAY_NOON)).toBe(12 * 60);
  });

  it("UTC+3 yaz saati ofsetini doğru uygular", () => {
    // 09:00 TR = 06:00 UTC
    expect(turkeyWallClockToUtc(2024, 5, 13, 9 * 60)).toBe(
      Date.parse("2024-05-13T06:00:00Z"),
    );
  });

  it("dakikayı HH:MM biçimine çevirir", () => {
    expect(formatMinutes(9 * 60)).toBe("09:00");
    expect(formatMinutes(14 * 60 + 30)).toBe("14:30");
  });

  it("geçersiz saat değerinde null döner", () => {
    expect(toMinutes(undefined)).toBeNull();
    expect(toMinutes("aa:bb")).toBeNull();
    expect(toMinutes("09:30")).toBe(9 * 60 + 30);
  });
});

describe("computeAvailability", () => {
  it("gün kapalıysa boş slot bildirmez", () => {
    const result = computeAvailability({ ...base, now: SUNDAY });
    expect(result.isOpen).toBe(false);
    expect(result.hasFreeSlot).toBe(false);
    expect(result.reason).toBe("closed");
  });

  it("açık günde ilk boş slotu döner", () => {
    const result = computeAvailability({ ...base, now: MONDAY_MORNING });
    expect(result.isOpen).toBe(true);
    expect(result.hasFreeSlot).toBe(true);
    expect(result.nextSlot).toBe("09:00");
  });

  it("geçmiş saatleri atlar — 12:00'de ilk slot 12:00 olmalı", () => {
    const result = computeAvailability({ ...base, now: MONDAY_NOON });
    expect(result.nextSlot).toBe("12:00");
  });

  it("günün sonunda slot kalmadıysa 'dolu' döner", () => {
    const result = computeAvailability({ ...base, now: MONDAY_TOO_LATE });
    expect(result.isOpen).toBe(true);
    expect(result.hasFreeSlot).toBe(false);
    expect(result.reason).toBe("fully_booked");
  });

  it("kapanış saatine yeten son sloti hâlâ önerir", () => {
    // 17:30 + 30dk = 18:00 → kapanışa tam yetiyor, slot hâlâ geçerli.
    const result = computeAvailability({ ...base, now: MONDAY_EVENING });
    expect(result.nextSlot).toBe("17:30");
  });

  it("hizmet yoksa randevu alınamaz", () => {
    const result = computeAvailability({
      ...base,
      serviceDurations: [],
      now: MONDAY_MORNING,
    });
    expect(result.hasFreeSlot).toBe(false);
    expect(result.reason).toBe("no_services");
  });

  it("slotu kapatan randevu varsa sonraki slota atlar", () => {
    // 09:00-10:00 arası dolu → ilk boş slot 10:00 olmalı.
    const result = computeAvailability({
      ...base,
      now: MONDAY_MORNING,
      busyRanges: [
        {
          start: Date.parse("2024-05-13T06:00:00Z"),
          end: Date.parse("2024-05-13T07:00:00Z"),
          staffId: "staff-1",
        },
      ],
    });
    expect(result.nextSlot).toBe("10:00");
  });

  it("elemana özel randevu yalnızca o elemanı engeller", () => {
    // Başka bir elemanın randevusu: staff-1 boş olduğu için ilk slot 09:00.
    const result = computeAvailability({
      ...base,
      staffIds: ["staff-1", "staff-2"],
      now: MONDAY_MORNING,
      busyRanges: [
        {
          start: Date.parse("2024-05-13T06:00:00Z"),
          end: Date.parse("2024-05-13T07:00:00Z"),
          staffId: "staff-2",
        },
      ],
    });
    expect(result.nextSlot).toBe("09:00");
  });

  it("eleman seçilmeden alınan randevu tüm elemanları bloke eder", () => {
    const result = computeAvailability({
      ...base,
      staffIds: ["staff-1", "staff-2"],
      now: MONDAY_MORNING,
      busyRanges: [
        {
          start: Date.parse("2024-05-13T06:00:00Z"),
          end: Date.parse("2024-05-13T07:00:00Z"),
          staffId: null,
        },
      ],
    });
    expect(result.nextSlot).toBe("10:00");
  });

  it("tüm elemanlar doluysa o slotu atlar", () => {
    const result = computeAvailability({
      ...base,
      staffIds: ["staff-1", "staff-2"],
      now: MONDAY_MORNING,
      busyRanges: [
        {
          start: Date.parse("2024-05-13T06:00:00Z"),
          end: Date.parse("2024-05-13T07:00:00Z"),
          staffId: "staff-1",
        },
        {
          start: Date.parse("2024-05-13T06:00:00Z"),
          end: Date.parse("2024-05-13T07:00:00Z"),
          staffId: "staff-2",
        },
      ],
    });
    expect(result.nextSlot).toBe("10:00");
  });

  it("uzun hizmet kapanış saatine sığmayan slotu önermez", () => {
    // 120 dakikalık hizmet, 18:00 kapanışta → son slot 16:00.
    const result = computeAvailability({
      ...base,
      serviceDurations: [120],
      now: MONDAY_MORNING,
    });
    expect(result.nextSlot).toBe("09:00");
  });

  it("saat tanımı yoksa gün boyu müsait sayılır", () => {
    const result = computeAvailability({
      ...base,
      workingHours: null,
      now: MONDAY_MORNING,
    });
    expect(result.isOpen).toBe(true);
    expect(result.hasFreeSlot).toBe(true);
  });

  it("slot aralığı ayarı 45 dakika ise ızgarayı ona göre üretir", () => {
    const result = computeAvailability({
      ...base,
      slotDuration: 45,
      now: MONDAY_MORNING,
    });
    expect(result.nextSlot).toBe("09:00");
  });

  it("gece yarısını geçen Türkiye tarihi doğru gün sayılır", () => {
    // 2024-05-13 00:30 TR → hâlâ 13 Mayıs pazartesi.
    const lateNight = new Date("2024-05-12T21:30:00Z");
    expect(dayKeyInTurkey(lateNight)).toBe("pazartesi");
    const result = computeAvailability({ ...base, now: lateNight });
    expect(result.nextSlot).toBe("09:00");
  });
});
