import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import { updateTenantSchema, validateRequest } from "@/lib/validations";
import { isSuperAdmin } from "@/lib/admin";

async function checkAuth() {
  const supabaseUser = await createServerClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user || !isSuperAdmin(user.email)) {
    throw new Error("Yetkisiz işlem. Süper Admin değilsiniz.");
  }
}

export async function GET() {
  try {
    await checkAuth();
    const supabaseAdmin = createAdminClient();
    
    // İşletmeleri ve onlara bağlı profilleri çek
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from("tenants")
      .select(`
        id, name, sector, created_at,
        profiles (id, full_name, role)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (tenantsError) throw tenantsError;

    // Kullanıcı e-postaları için auth tablosunu çek
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const userMap = new Map();
    authUsers.users.forEach(u => userMap.set(u.id, u.email));

    const result = tenants.map((t: any) => {
      const ownerProfile = t.profiles?.find((p: any) => p.role === "owner") || (t.profiles && t.profiles[0]);
      const userId = ownerProfile?.id;
      return {
        tenantId: t.id,
        tenantName: t.name,
        sector: t.sector,
        createdAt: t.created_at,
        userId: userId || null,
        fullName: ownerProfile?.full_name || "Sahipsiz İşletme",
        email: userId ? (userMap.get(userId) || "Bulunamadı") : "Sahipsiz İşletme"
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
    const body = await req.json();
    const validation = validateRequest(updateTenantSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { userId, tenantId, email, password, tenantName } = validation.data;
    const supabaseAdmin = createAdminClient();

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

    const supabaseAdmin = createAdminClient();

    if (tenantId) {
      // 1. appointments sil
      const { error: appErr } = await supabaseAdmin.from("appointments").delete().eq("tenant_id", tenantId);
      if (appErr) throw new Error(`Randevular silinirken hata: ${appErr.message}`);

      // 2. services sil
      const { error: srvErr } = await supabaseAdmin.from("services").delete().eq("tenant_id", tenantId);
      if (srvErr) throw new Error(`Hizmetler silinirken hata: ${srvErr.message}`);

      // 3. notifications ve push_subscriptions sil
      const { error: notifErr } = await supabaseAdmin.from("notifications").delete().eq("tenant_id", tenantId);
      if (notifErr) throw new Error(`Bildirimler silinirken hata: ${notifErr.message}`);

      const { error: pushErr } = await supabaseAdmin.from("push_subscriptions").delete().eq("tenant_id", tenantId);
      if (pushErr) throw new Error(`Push abonelikleri silinirken hata: ${pushErr.message}`);

      // 4. profiles tablosunda tenant_id'si bu olanların tenant_id değerini null yap
      const { error: profErr } = await supabaseAdmin.from("profiles").update({ tenant_id: null }).eq("tenant_id", tenantId);
      if (profErr) throw new Error(`Profiller güncellenirken hata: ${profErr.message}`);
    }

    // Kullanıcıyı auth'dan tamamen sil
    if (userId && userId !== "null") {
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authErr) throw new Error(`Kullanıcı silinemedi: ${authErr.message}`);
    }
    
    // 5. Kiracıyı (Tenants) en son sil
    if (tenantId) {
      const { error: tErr } = await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
      if (tErr) throw new Error(`İşletme silinirken hata: ${tErr.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
