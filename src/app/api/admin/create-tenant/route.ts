import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];

export async function POST(req: Request) {
  try {
    // GÜVENLİK KONTROLÜ
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    
    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
      return NextResponse.json({ error: "Yetkisiz işlem. Süper Admin girişi yapılmadı." }, { status: 403 });
    }

    const { email, password, tenantName, sector, fullName } = await req.json();

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Sunucu ayarları eksik. Lütfen .env.local dosyasına SUPABASE_SERVICE_ROLE_KEY eklediğinizden emin olun." }, { status: 500 });
    }

    // RLS'yi atlayan Supabase Admin bağlantısı
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Auth (Kimlik Doğrulama) kısmında kullanıcıyı oluştur
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // Trigger'ın arka planda çalışmasını 1 saniye bekleyelim
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Trigger (eğer varsa) otomatik profil oluşturdu mu kontrol et
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 6);

    if (existingProfile) {
      const tenantId = existingProfile.tenant_id;
      
      await supabaseAdmin.from("tenants").update({
        name: tenantName,
        sector: sector,
        slug: slug
      }).eq("id", tenantId);

      await supabaseAdmin.from("profiles").update({
        full_name: fullName,
      }).eq("id", userId);

      return NextResponse.json({ success: true, message: "İşletme başarıyla oluşturuldu ve ayarlandı!" });
    } else {
      const { data: tenantData, error: tenantError } = await supabaseAdmin.from("tenants").insert({
        name: tenantName,
        slug: slug,
        sector: sector
      }).select("id").single();

      if (tenantError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: "İşletme oluşturulurken hata: " + tenantError.message }, { status: 400 });
      }

      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        tenant_id: tenantData.id,
        full_name: fullName,
        role: "owner"
      });

      if (profileError) {
        return NextResponse.json({ error: "Profil oluşturulurken hata: " + profileError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "İşletme sıfırdan başarıyla oluşturuldu!" });
    }

  } catch (err: any) {
    return NextResponse.json({ error: "Beklenmeyen sunucu hatası: " + err.message }, { status: 500 });
  }
}
