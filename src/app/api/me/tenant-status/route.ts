import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { isSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Oturumdaki kullanıcının işletme durumu.
 *
 * Neden gerekli: `tenants` tablosundaki RLS, askıya alınmış/kapalı işletmelerin
 * satırını personelden (ve bazı durumlarda sahibinden) gizler. Bu yüzden panel,
 * askıya alınmış bir işletmeye bağlı personel için "boş panel" gösteriyordu ve
 * mevcut "üyelik kapalı" ekranı hiç tetiklenmiyordu.
 *
 * Bu uç yalnızca İSTEĞİ YAPAN kullanıcının kendi işletmesinin durumunu döner
 * (service-role ile okunur, dışarıya bilgi sızdırmaz):
 *
 *   { state: "none" }                     → işletmeye bağlı değil
 *   { state: "missing" }                  → bağlı olduğu işletme silinmiş
 *   { state: "ok" | "closed", ... }       → durum bilgisiyle birlikte
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ state: "anonymous" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const tenantId: string | null = profile?.tenant_id ?? null;
    if (!tenantId) {
      return NextResponse.json({ state: "none", role: profile?.role ?? null });
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select(
        "id, name, slug, is_active, membership_status, trial_ends_at, membership_ends_at",
      )
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({
        state: "missing",
        role: profile?.role ?? null,
        isSuperAdmin: isSuperAdmin(user.email),
      });
    }

    return NextResponse.json({
      state: "ok",
      role: profile?.role ?? null,
      isSuperAdmin: isSuperAdmin(user.email),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.is_active,
        membershipStatus: tenant.membership_status,
        trialEndsAt: tenant.trial_ends_at,
        membershipEndsAt: tenant.membership_ends_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
