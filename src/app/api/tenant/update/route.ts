import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/admin";
import { updateTenantProfileSchema, validateRequest } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await req.json();
    const validation = validateRequest(updateTenantProfileSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { tenantId, name, phone, email, address, description, province, district, profile_image_url, cover_image_url, sector, working_hours } = validation.data;

    const supabaseAdmin = createAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("tenant_id, role").eq("id", user.id).single();
    
    if (profileError) {
      console.error("Profile fetch error in API:", profileError);
      return NextResponse.json({ error: "Profil doğrulanamadı." }, { status: 500 });
    }
    
    const isSuperAdminUser = isSuperAdmin(user.email);
    const isOwner = profile?.role === "owner" && profile?.tenant_id === tenantId;

    if (!isSuperAdminUser && !isOwner) {
      console.error("API Auth Error:", { userEmail: user.email, profile, tenantId, isSuperAdmin: isSuperAdminUser, isOwner });
      return NextResponse.json({ error: `Yetkisiz işlem. (Rol: ${profile?.role}, Kayıtlı Tenant: ${profile?.tenant_id}, İstek: ${tenantId})` }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("tenants").update({
      name,
      phone,
      email,
      address,
      description,
      province,
      district,
      profile_image_url,
      cover_image_url,
      sector,
      working_hours
    }).eq("id", tenantId);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: "Veritabanı güncelleme hatası: " + error.message }, { status: 500 });
    }

    // Next.js önbelleğini temizle (revalidate)
    revalidatePath('/dashboard/ayarlar', 'page');
    revalidatePath('/discover', 'page');
    revalidatePath('/', 'layout');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Catch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
