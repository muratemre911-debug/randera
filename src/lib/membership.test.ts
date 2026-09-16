import { describe, expect, it } from "vitest";
import {
  MONTHLY_DAYS,
  TRIAL_DAYS,
  formatRemaining,
  getMembership,
  isDiscoverable,
  isMembershipOpen,
  isUnlimitedStatus,
  remainingDays,
  shiftEndDate,
} from "./membership";

const now = new Date("2026-09-16T12:00:00.000Z");
const iso = (days: number) =>
  new Date(now.getTime() + days * 86400000).toISOString();

describe("remainingDays", () => {
  it("kalan günü yukarı yuvarlar, geçmiş/boş için 0 döner", () => {
    expect(remainingDays(iso(5), now)).toBe(5);
    expect(remainingDays(iso(0.2), now)).toBe(1);
    expect(remainingDays(iso(-1), now)).toBe(0);
    expect(remainingDays(null, now)).toBe(0);
  });
});

describe("getMembership", () => {
  it("süper admin kapattıysa (suspended) her şeyi geçersiz kılar", () => {
    expect(
      getMembership(
        { membership_status: "suspended", membership_ends_at: iso(100) },
        now,
      ).kind,
    ).toBe("suspended");
    expect(
      isMembershipOpen(
        { membership_status: "suspended", membership_ends_at: iso(100) },
        now,
      ),
    ).toBe(false);
  });

  it("ücretli üyelik denemeden önce gelir", () => {
    const row = {
      membership_status: "active",
      membership_ends_at: iso(20),
      trial_ends_at: iso(3),
    };
    expect(getMembership(row, now)).toMatchObject({
      kind: "active",
      daysLeft: 20,
    });
  });

  it("üyelik bitmişse denemeyi gösterir", () => {
    const row = {
      membership_status: "active",
      membership_ends_at: iso(-1),
      trial_ends_at: iso(9),
    };
    expect(getMembership(row, now)).toMatchObject({
      kind: "trial",
      daysLeft: 9,
    });
  });

  it("ikisi de bitmişse expired olur", () => {
    const row = { membership_ends_at: iso(-1), trial_ends_at: iso(-10) };
    expect(getMembership(row, now).kind).toBe("expired");
  });

  it("sınırsız üyelik (süper admin) hiçbir zaman kapanmaz", () => {
    const row = {
      membership_status: "unlimited",
      trial_ends_at: iso(-99),
      membership_ends_at: iso(-99),
    };
    expect(getMembership(row, now)).toEqual({
      kind: "unlimited",
      daysLeft: 0,
      endsAt: null,
    });
    expect(isMembershipOpen(row, now)).toBe(true);
    expect(isDiscoverable(row, now)).toBe(true);
    expect(isUnlimitedStatus(row)).toBe(true);
    expect(formatRemaining(getMembership(row, now))).toBe("Sınırsız üyelik");
    expect(isUnlimitedStatus({ membership_status: "active" })).toBe(false);
  });

  it("keşfet listesi: üyeliği kapalı/süresi dolmuş işletmeler gizlenir, üyelik bilgisi olmayanlar gizlenmez", () => {
    expect(
      isDiscoverable(
        { membership_status: "suspended", membership_ends_at: iso(10) },
        now,
      ),
    ).toBe(false);
    expect(isDiscoverable({ membership_ends_at: iso(10) }, now)).toBe(true);
    expect(isDiscoverable({ trial_ends_at: iso(-1) }, now)).toBe(false);
    // migration öncesi kayıtlar (hiç üyelik kolonu yok) listelenmeye devam eder
    expect(isDiscoverable({}, now)).toBe(true);
  });
});

describe("shiftEndDate", () => {
  it("kalan sürenin üzerine ekler", () => {
    const end = shiftEndDate(iso(20), 30, now);
    expect(remainingDays(end, now)).toBe(50);
  });

  it("süre bitmişse bugünden başlar", () => {
    expect(remainingDays(shiftEndDate(iso(-5), 14, now), now)).toBe(14);
    expect(remainingDays(shiftEndDate(null, 30, now), now)).toBe(30);
  });

  it("negatif gün süreyi düşürür, gerekirse geçmişe çeker", () => {
    expect(remainingDays(shiftEndDate(iso(30), -10, now), now)).toBe(20);
    const expired = shiftEndDate(iso(10), -30, now);
    expect(new Date(expired).getTime()).toBeLessThan(now.getTime());
    expect(
      getMembership(
        { membership_status: "active", membership_ends_at: expired },
        now,
      ).kind,
    ).toBe("expired");
  });

  it("kısayol günleri", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(MONTHLY_DAYS).toBe(30);
  });
});

describe("formatRemaining", () => {
  it("türkçe metinler", () => {
    expect(formatRemaining({ kind: "trial", daysLeft: 12, endsAt: null })).toBe(
      "12 gün deneme kaldı",
    );
    expect(formatRemaining({ kind: "active", daysLeft: 3, endsAt: null })).toBe(
      "3 gün üyelik kaldı",
    );
    expect(
      formatRemaining({ kind: "suspended", daysLeft: 0, endsAt: null }),
    ).toBe("Üyelik kapalı");
    expect(
      formatRemaining({ kind: "expired", daysLeft: 0, endsAt: null }),
    ).toBe("Üyelik süresi doldu");
  });
});
