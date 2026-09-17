import { describe, it, expect } from "vitest";
import {
  buildWhatsAppInviteUrl,
  isOwnerRole,
  servicesForStaff,
  sortStaffOwnerFirst,
  staffDisplayName,
} from "./staff";

describe("sortStaffOwnerFirst", () => {
  it("işletme sahibini listenin başına alır, diğerlerinin sırasını korur", () => {
    const staff = [
      { id: "a", role: "staff" },
      { id: "owner", role: "owner" },
      { id: "b", role: "staff" },
    ];
    expect(sortStaffOwnerFirst(staff).map((s) => s.id)).toEqual([
      "owner",
      "a",
      "b",
    ]);
  });

  it("orijinal diziyi değiştirmez", () => {
    const staff = [
      { id: "a", role: "staff" },
      { id: "o", role: "owner" },
    ];
    sortStaffOwnerFirst(staff);
    expect(staff[0].id).toBe("a");
  });
});

describe("servicesForStaff", () => {
  const services = [
    { id: "1", staff_id: "owner" },
    { id: "2", staff_id: "staff-a" },
    { id: "3", staff_id: null },
  ];

  it("sadece seçilen elemanın hizmetlerini döner", () => {
    expect(servicesForStaff(services, "staff-a").map((s) => s.id)).toEqual([
      "2",
      "3",
    ]);
  });

  it("eleman seçilmemişse tüm hizmetleri döner", () => {
    expect(servicesForStaff(services, null)).toHaveLength(3);
  });

  it("staff_id taşımayan eski kayıtlar her elemanda görünür (geriye dönük uyum)", () => {
    const legacy: { id: string; staff_id?: string | null }[] = [
      { id: "x" },
      { id: "y" },
    ];
    expect(servicesForStaff(legacy, "staff-a").map((s) => s.id)).toEqual([
      "x",
      "y",
    ]);
  });

  it("başka bir elemanın hizmeti sızmaz", () => {
    expect(servicesForStaff(services, "owner").map((s) => s.id)).toEqual([
      "1",
      "3",
    ]);
  });
});

describe("buildWhatsAppInviteUrl", () => {
  it("linki ve işletme adını kodlayarak wa.me adresi üretir", () => {
    const url = buildWhatsAppInviteUrl(
      "https://randera.app/davet/abc123",
      "Kuaför A",
    );
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("https://randera.app/davet/abc123");
    expect(text).toContain("Kuaför A");
  });
});

describe("isOwnerRole / staffDisplayName", () => {
  it("sadece 'owner' rolünü sahip sayar", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("staff")).toBe(false);
    expect(isOwnerRole(null)).toBe(false);
  });

  it("isim yoksa yedeğe düşer", () => {
    expect(staffDisplayName({ id: "1", role: "staff", full_name: null })).toBe(
      "İşletme",
    );
    expect(
      staffDisplayName({ id: "1", role: "staff", full_name: "  Ayşe  " }),
    ).toBe("Ayşe");
  });
});
