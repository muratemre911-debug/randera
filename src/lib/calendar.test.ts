import { describe, expect, it } from "vitest";
import { buildGoogleCalendarUrl, buildIcsContent } from "./calendar";

const event = {
  id: "abc-123",
  title: "Saç Kesimi - Randera",
  start: "2024-05-13T09:00:00.000Z",
  end: "2024-05-13T09:30:00.000Z",
  description: "Randera randevusu",
  location: "İstanbul",
};

describe("buildGoogleCalendarUrl", () => {
  it("başlangıç ve bitiş damgalarını içerir", () => {
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain("20240513T090000Z");
    expect(url).toContain("20240513T093000Z");
  });

  it("başlığı URL-kodlar", () => {
    expect(buildGoogleCalendarUrl(event)).toContain(
      "text=Sa%C3%A7+Kesimi+-+Randera",
    );
  });
});

describe("buildIcsContent", () => {
  it("temel VCALENDAR alanlarını üretir", () => {
    const ics = buildIcsContent(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc-123@randera.com");
    expect(ics).toContain("DTSTART:20240513T090000Z");
    expect(ics).toContain("DTEND:20240513T093000Z");
  });

  it("RFC 5545'e göre CRLF satır sonu kullanır", () => {
    const ics = buildIcsContent(event);
    expect(ics.split("\r\n").length).toBeGreaterThan(5);
    // Satır sonu dışında ham \n kalmamalı
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("metindeki özel karakterleri kaçırır", () => {
    const ics = buildIcsContent({
      ...event,
      title: "Saç; Kesim, Özel\\Karakter",
      description: "Satır1\nSatır2",
    });
    expect(ics).toContain("Saç\\; Kesim\\, Özel\\\\Karakter");
    expect(ics).toContain("Satır1\\nSatır2");
  });

  it("bitiş verilmezse süreden hesaplar", () => {
    const ics = buildIcsContent({
      id: "x",
      title: "Test",
      start: "2024-05-13T09:00:00.000Z",
      durationMinutes: 90,
    });
    expect(ics).toContain("DTEND:20240513T103000Z");
  });
});
