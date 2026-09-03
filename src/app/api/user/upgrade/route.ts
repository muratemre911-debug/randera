import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const { tenantName, sector } = await req.json();
    if (!tenantName || !sector) {
      return NextResponse.json({ error: "İşletme adı ve sektör zorunludur." }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Sunucu ayarları eksik." }, { status: 500 });
    }

    const supabaseAdmin = createAdminClient();

    // Check current role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single();

    if (profile?.role === "owner" && profile?.tenant_id) {
      return NextResponse.json({ error: "Zaten bir işletme hesabınız var." }, { status: 400 });
    }

    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 6);

    const { data: tenantData, error: tenantError } = await supabaseAdmin.from("tenants").insert({
      name: tenantName,
      slug: slug,
      sector: sector
    }).select("id").single();

    if (tenantError) {
      return NextResponse.json({ error: "İşletme oluşturulurken hata: " + tenantError.message }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").update({
      tenant_id: tenantData.id,
      role: "owner"
    }).eq("id", user.id);

    if (profileError) {
      return NextResponse.json({ error: "Profil güncellenirken hata: " + profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "İşletme hesabı başarıyla oluşturuldu!" });

  } catch (err: any) {
    return NextResponse.json({ error: "Beklenmeyen sunucu hatası: " + err.message }, { status: 500 });
  }
}
