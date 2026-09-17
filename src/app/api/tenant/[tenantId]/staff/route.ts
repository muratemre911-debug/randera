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

    return NextResponse.json({ staff: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("Fetch tenant staff error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
