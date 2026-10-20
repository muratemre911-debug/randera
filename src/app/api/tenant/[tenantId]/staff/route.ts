import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

/**
 * İşletmenin herkese açık ekip listesi (müşteri randevu akışındaki
 * "Önce Eleman Seçimi" adımı için). Telefon gibi özel alanlar dönmez.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("tenant_id", tenantId)
      .in("role", ["owner", "staff"])
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Elemana özel ayarlar: randevu akışı, seçilen elemanın saat ve kuralları
    // varsa onları, boş bıraktığı alanlarda işletmenin değerlerini kullanır.
    const { data: settingsRows } = await supabaseAdmin
      .from("staff_settings")
      .select("profile_id, working_hours, booking_rules")
      .eq("tenant_id", tenantId);

    const settingsMap = new Map(
      (settingsRows ?? []).map((r) => [
        r.profile_id,
        { working_hours: r.working_hours, booking_rules: r.booking_rules },
      ]),
    );

    const staff = (data ?? []).map((p) => ({
      ...p,
      working_hours: settingsMap.get(p.id)?.working_hours ?? null,
      booking_rules: settingsMap.get(p.id)?.booking_rules ?? null,
    }));

    return NextResponse.json({ staff });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("Fetch tenant staff error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
