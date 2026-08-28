import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await req.json();
    const { tenantId, name, phone, email, address, province, district, profile_image_url, cover_image_url, sector } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID eksik." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("tenant_id, role").eq("id", user.id).single();
    
    if (profileError) {
      console.error("Profile fetch error in API:", profileError);
      return NextResponse.json({ error: "Profil doğrulanamadı." }, { status: 500 });
    }
    
    const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email || "");
    const isOwner = profile?.role === "owner" && profile?.tenant_id === tenantId;

    if (!isSuperAdmin && !isOwner) {
      console.error("API Auth Error:", { userEmail: user.email, profile, tenantId, isSuperAdmin, isOwner });
      return NextResponse.json({ error: `Yetkisiz işlem. (Rol: ${profile?.role}, Kayıtlı Tenant: ${profile?.tenant_id}, İstek: ${tenantId})` }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("tenants").update({
      name,
      phone,
      email,
      address,
      province,
      district,
      profile_image_url,
      cover_image_url,
      sector
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
