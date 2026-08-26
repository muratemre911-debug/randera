import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscription } = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // RLS'yi atlamak için Admin Client kullanıyoruz
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Kullanıcının tenant_id'sini bul
    const { data: profile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile) throw new Error("Profil bulunamadı");

    const tenantId = profile.tenant_id;

    // Aboneliği kaydet (varsa update et, yoksa insert)
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
      tenant_id: tenantId,
      endpoint: subscription.endpoint,
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh
    }, { onConflict: "endpoint" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
