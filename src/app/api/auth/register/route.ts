import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, nickname } = await req.json();

    if (!email || !password || !fullName || !nickname) {
      return NextResponse.json({ error: "Lütfen tüm alanları doldurun." }, { status: 400 });
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(normalizedNickname)) {
      return NextResponse.json({ error: "Kullanıcı adı 3-30 karakter olmalı ve sadece harf, rakam, nokta (.) ve alt çizgi (_) içerebilir." }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik (Service Role Key)." }, { status: 500 });
    }

    const supabaseAdmin = createAdminClient();

    // Kullanıcı adı benzersiz olmalı
    const { data: existingNick } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("nickname", normalizedNickname)
      .maybeSingle();

    if (existingNick) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanılıyor. Lütfen farklı bir tane seçin." }, { status: 400 });
    }

    // 1. Kullanıcıyı e-posta onayıyla birlikte doğrudan oluştur
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

    // Trigger kaynaklı otomatik oluşan bir tenant varsa onu bulup silmek için kontrol et
    const { data: existingProfile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("id", userId).single();
    
    if (existingProfile && existingProfile.tenant_id) {
      await supabaseAdmin.from("tenants").delete().eq("id", existingProfile.tenant_id);
    }

    // 2. Profile tablosuna customer rolüyle ekle/güncelle ve tenant_id'yi sıfırla
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      nickname: normalizedNickname,
      role: "customer",
      tenant_id: null
    });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      return NextResponse.json({ error: "Profil oluşturulurken hata: " + profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Sunucu hatası: " + err.message }, { status: 500 });
  }
}
