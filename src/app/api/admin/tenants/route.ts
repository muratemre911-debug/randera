import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];

async function checkAuth() {
  const supabaseUser = await createServerClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
    throw new Error("Yetkisiz işlem. Süper Admin değilsiniz.");
  }
}

export async function GET() {
  try {
    await checkAuth();
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // İşletmeleri ve onlara bağlı profilleri çek
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from("tenants")
      .select(`
        id, name, sector, created_at,
        profiles (id, full_name, role)
      `)
      .order("created_at", { ascending: false });

    if (tenantsError) throw tenantsError;

    // Kullanıcı e-postaları için auth tablosunu çek
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const userMap = new Map();
    authUsers.users.forEach(u => userMap.set(u.id, u.email));

    const result = tenants.map((t: any) => {
      const ownerProfile = t.profiles.find((p: any) => p.role === "owner") || t.profiles[0];
      const userId = ownerProfile?.id;
      return {
        tenantId: t.id,
        tenantName: t.name,
        sector: t.sector,
        createdAt: t.created_at,
        userId: userId,
        fullName: ownerProfile?.full_name || "Bilinmiyor",
        email: userId ? userMap.get(userId) : "Bulunamadı"
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await checkAuth();
    const { userId, tenantId, email, password, tenantName } = await req.json();
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // E-posta veya şifre güncelleniyorsa Auth modülüne istek at
    const updates: any = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    
    if (Object.keys(updates).length > 0 && userId) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
      if (authError) throw authError;
    }

    // İşletme adı güncelleniyorsa Tenants tablosuna istek at
    if (tenantName && tenantId) {
      const { error: tenantError } = await supabaseAdmin.from("tenants").update({ name: tenantName }).eq("id", tenantId);
      if (tenantError) throw tenantError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await checkAuth();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const tenantId = searchParams.get("tenantId");

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Kullanıcıyı tamamen sil (Profil tablosundaki cascade ayarı varsa oradan da uçar)
    if (userId) {
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authErr) console.warn("Kullanıcı silinemedi:", authErr);
    }
    
    // Kiracıyı (Tenants) tamamen sil
    if (tenantId) {
      const { error: tErr } = await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
      if (tErr) console.warn("İşletme silinemedi:", tErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
