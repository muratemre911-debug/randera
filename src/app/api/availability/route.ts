import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  computeAvailability,
  type BusyRange,
  type WorkingHoursMap,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * Birden çok işletmenin "bugün müsait" durumunu TEK sorguyla döner.
 *
 * Neden toplu bir uç: keşfet ekranı onlarca işletmeyi listeler. Her işletme
 * için ayrı `/api/tenant/[id]/availability` çağrısı yapmak N+1 sorguya ve
 * N istek üstüne yol açardı. Burada tüm randevular TEK `in` sorgusuyla
 * çekilir, hesap sunucuda yapılır.
 *
 *   GET ?ids=<uuid1,uuid2,...>
 *
 * Yanıt: `{ "<tenantId>": { isOpen, hasFreeSlot, nextSlot, reason } }`
 *
 * Güvenlik: uç kimlik doğrulaması gerektirmez; yalnızca herkese açık
 * "boş saat var mı" bilgisini döner. Müşteri adı, telefon veya randevu
 * detayı SIZDIRILMAZ.
 */

interface TenantRow {
  id: string;
  working_hours: WorkingHoursMap | null;
  booking_rules: { slotDuration?: number } | null;
}

/** PostgreSQL uuid biçiminde mi? Geçersiz id tüm sorguyu bozmasın. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") ?? "";
    const tenantIds = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => UUID_RE.test(id))
      .slice(0, 200); // gereksiz büyük istekleri sınırla

    if (tenantIds.length === 0) {
      return NextResponse.json({});
    }

    const supabase = createAdminClient();
    const now = new Date();

    // 1) İşletmeler: saatler + randevu kuralları
    const { data: tenantRows, error: tenantError } = await supabase
      .from("tenants")
      .select("id, working_hours, booking_rules")
      .in("id", tenantIds);

    if (tenantError) throw tenantError;

    const tenants = (tenantRows ?? []) as TenantRow[];

    // 2) Aktif hizmet süreleri (slotun sığması için gereken en kısa süre)
    const { data: serviceRows, error: serviceError } = await supabase
      .from("services")
      .select("tenant_id, duration")
      .in("tenant_id", tenantIds)
      .eq("is_active", true);

    if (serviceError) throw serviceError;

    // 3) Elemanlar (hangi elemana ait randevular var)
    const { data: staffRows, error: staffError } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .in("tenant_id", tenantIds)
      .in("role", ["owner", "staff"]);

    if (staffError) throw staffError;

    // 4) Bugünkü randevular — tek sorgu, tüm işletmeler için.
    //    Önceki gün başlayan kayıtlar da bugüne taşabilir (gece yarısını
    //    aşan hizmetler), bu yüzden bir gün öncesinden başlanır.
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const rangeStart = new Date(dayStart.getTime() - 86400000);
    const rangeEnd = new Date(dayStart.getTime() + 86400000);

    const { data: apptRows, error: apptError } = await supabase
      .from("appointments")
      .select("tenant_id, staff_id, start_time, end_time")
      .in("tenant_id", tenantIds)
      .neq("status", "cancelled")
      .gte("start_time", rangeStart.toISOString())
      .lte("start_time", rangeEnd.toISOString());

    if (apptError) throw apptError;

    // Veriyi işletme bazında grupla
    const durationsByTenant = new Map<string, number[]>();
    for (const s of (serviceRows ?? []) as { tenant_id: string; duration: number }[]) {
      const list = durationsByTenant.get(s.tenant_id) ?? [];
      if (s.duration > 0) list.push(s.duration);
      durationsByTenant.set(s.tenant_id, list);
    }

    const staffByTenant = new Map<string, string[]>();
    for (const p of (staffRows ?? []) as { id: string; tenant_id: string }[]) {
      const list = staffByTenant.get(p.tenant_id) ?? [];
      list.push(p.id);
      staffByTenant.set(p.tenant_id, list);
    }

    const busyByTenant = new Map<string, BusyRange[]>();
    for (const a of (apptRows ?? []) as {
      tenant_id: string;
      staff_id: string | null;
      start_time: string;
      end_time: string | null;
    }[]) {
      const start = Date.parse(a.start_time);
      const end = a.end_time
        ? Date.parse(a.end_time)
        : start + 3600000; // eski kayıtlar: 1 saat varsay
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      const list = busyByTenant.get(a.tenant_id) ?? [];
      list.push({ start, end, staffId: a.staff_id ?? null });
      busyByTenant.set(a.tenant_id, list);
    }

    // 5) Hesap
    const result: Record<
      string,
      {
        isOpen: boolean;
        hasFreeSlot: boolean;
        nextSlot: string | null;
        reason: string;
      }
    > = {};

    for (const tenant of tenants) {
      const availability = computeAvailability({
        workingHours: tenant.working_hours,
        slotDuration: tenant.booking_rules?.slotDuration ?? null,
        serviceDurations: durationsByTenant.get(tenant.id) ?? [],
        staffIds: staffByTenant.get(tenant.id) ?? [],
        busyRanges: busyByTenant.get(tenant.id) ?? [],
        now,
      });
      result[tenant.id] = availability;
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("Bulk availability error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}