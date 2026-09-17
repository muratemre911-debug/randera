import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * İşletmenin (veya seçilen elemanın) dolu saatleri.
 *
 * Randevu sihirbazı bu uçtan beslenir: `appointments` tablosunda RLS müşteriye
 * yalnızca kendi randevularını gösterdiği için dolu saatler istemciden doğrudan
 * okunamaz. Burada yalnızca başlangıç zamanları döner; müşteri bilgisi sızmaz.
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
        .select("start_time")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        .gte("start_time", from)
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

    return NextResponse.json({
      busy: (rows ?? []).map((r) => r.start_time),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("Availability query error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
