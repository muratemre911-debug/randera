import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * İşletmenin (veya seçilen elemanın) dolu saatleri.
 *
 * Randevu sihirbazı bu uçtan beslenir: `appointments` tablosunda RLS müşteriye
 * yalnızca kendi randevularını gösterdiği için dolu saatler istemciden doğrudan
 * okunamaz. Burada başlangıç/bitiş zamanları döner; müşteri bilgisi sızmaz.
 *
 * `busy` yalnızca başlangıç zamanlarını verir (geriye dönük uyumluluk), ancak
 * tek başına yeterli DEĞİLDİR: 150 dakikalık bir hizmette 10:00'daki kayıt
 * 11:00 ve 12:00'i de kapatır. Bu yüzden `busyRanges` ile aralıklar da döner
 * ve istemci, hizmet süresine göre çakışan saatleri kapatır.
 *
 *   GET ?from=<ISO>&to=<ISO>&staffId=<uuid|yok>
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const staffId = searchParams.get("staffId");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from ve to parametreleri zorunlu." },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const buildQuery = (withStaff: boolean) => {
      let q = supabaseAdmin
        .from("appointments")
        .select("start_time, end_time")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        // `gte(start_time)` tek başına yetmez: önceki gün başlayıp bu güne
        // taşan bir kayıt da çakışır. Bu yüzden sorgu 1 gün öncesinden başlar.
        .gte("start_time", new Date(new Date(from).getTime() - 86400000).toISOString())
        .lte("start_time", to)
        .order("start_time");
      if (withStaff && staffId) q = q.eq("staff_id", staffId);
      return q;
    };

    const first = await buildQuery(Boolean(staffId));
    let rows = first.data;
    let error = first.error;

    // staff_id kolonu/filtresi sorun çıkarırsa işletme geneline düş
    if (error && staffId) {
      const retry = await buildQuery(false);
      rows = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    const rowsSafe = rows ?? [];
    return NextResponse.json({
      busy: rowsSafe.map((r) => r.start_time),
      busyRanges: rowsSafe.map((r) => ({
        start: r.start_time,
        // end_time boşsa (eski kayıtlar) 1 saatlik varsayım kullanılır.
        end:
          r.end_time ??
          new Date(new Date(r.start_time).getTime() + 3600000).toISOString(),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("Availability query error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
