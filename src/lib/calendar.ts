/**
 * Takvim (Google Calendar / .ics) yardımcıları.
 *
 * Neden ayrı dosya: Google Calendar bağlantısı ve .ics üretimi iki ayrı
 * dosyada (randevu sihirbazı ve "Randevularım") neredeyse birebir kopyaydı.
 * Artık tek yerden üretiliyor.
 *
 * Not: ICS satırları RFC 5545'e göre satır sonu `CRLF` olmalı ve metin
 * alanlarındaki özel karakterler (`;`, `,`, `\`, satır sonu) ters eğik
 * çizgiyle kaçırılmalı — aksi halde takvim uygulamaları dosyayı bozuk
 * okuyabiliyor.
 */

export interface CalendarEvent {
  /** Benzersiz olay kimliği (UID olarak kullanılır). */
  id: string;
  title: string;
  /** ISO 8601 başlangıç zamanı. */
  start: string | Date;
  /** ISO 8601 bitiş zamanı. Verilmezse `durationMinutes` ile hesaplanır. */
  end?: string | Date;
  durationMinutes?: number;
  description?: string;
  /** Google Calendar'da gösterilen ayrıntı alanı. */
  details?: string;
  location?: string;
}

/** ICS biçiminde kaçış uygulanması gereken karakterler. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** ISO → ICS zaman damgası (`20240513T090000Z`). */
function toIcsStamp(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Google Calendar "takvime ekle" bağlantısı üretir.
 *
 * Kullanıcı bağlantıya tıklayınca Google Takvim, olayı açılır onay
 * ekranıyla gösterir.
 */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const start = new Date(event.start);
  const end = event.end
    ? new Date(event.end)
    : new Date(start.getTime() + (event.durationMinutes ?? 45) * 60000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsStamp(start)}/${toIcsStamp(end)}`,
  });
  if (event.details ?? event.description) {
    params.set("details", event.details ?? event.description ?? "");
  }
  if (event.location) params.set("location", event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** .ics takvim dosyasının içeriğini üretir. */
export function buildIcsContent(event: CalendarEvent): string {
  const start = new Date(event.start);
  const end = event.end
    ? new Date(event.end)
    : new Date(start.getTime() + (event.durationMinutes ?? 45) * 60000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Randera//Appointment Booking//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@randera.com`,
    `DTSTAMP:${toIcsStamp(start)}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description ?? "")}`,
    `LOCATION:${escapeIcsText(event.location ?? "")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * .ics dosyasını indirir (Apple Takvim, Outlook).
 *
 * Yalnızca tarayıcıda çalışır.
 */
export function downloadIcsFile(event: CalendarEvent, filename?: string): void {
  const content = buildIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? `randera-${event.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Nesne URL'si hemen serbest bırakılmazsa bellek sızıntısı olur.
  window.URL.revokeObjectURL(url);
}
