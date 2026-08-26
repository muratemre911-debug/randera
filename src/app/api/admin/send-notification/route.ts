import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";

const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    const { title, message, targetType, targetId, sectorValue } = await req.json();

    if (!title || !message) {
      return NextResponse.json({ error: "Başlık ve mesaj zorunludur" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Hangi tenantlara gideceğini belirle
    let tenantIds: string[] = [];

    if (targetType === "all") {
      const { data } = await supabaseAdmin.from("tenants").select("id");
      tenantIds = data?.map(t => t.id) || [];
    } else if (targetType === "sector") {
      const { data } = await supabaseAdmin.from("tenants").select("id").eq("sector", sectorValue);
      tenantIds = data?.map(t => t.id) || [];
    } else if (targetType === "single") {
      tenantIds = [targetId];
    }

    if (tenantIds.length === 0) {
      return NextResponse.json({ error: "Gönderilecek hedef bulunamadı" }, { status: 400 });
    }

    // 1. Veritabanına in-app bildirimleri kaydet
    const notificationInserts = tenantIds.map(tid => ({
      tenant_id: tid,
      title,
      message,
      is_read: false
    }));

    const { error: dbError } = await supabaseAdmin.from("notifications").insert(notificationInserts);
    if (dbError) throw dbError;

    // 2. Web Push ile Cihaz Bildirimlerini Gönder
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(
        "mailto:test@example.com",
        vapidPublic,
        vapidPrivate
      );

      // Abonelikleri çek
      const { data: subscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .in("tenant_id", tenantIds);

      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({ title, body: message });
        
        // Hepsine paralel yolla
        await Promise.allSettled(
          subscriptions.map(sub => {
            const pushSub = {
              endpoint: sub.endpoint,
              keys: {
                auth: sub.auth,
                p256dh: sub.p256dh
              }
            };
            return webpush.sendNotification(pushSub, payload).catch(e => {
              // Eğer abonelik öldüyse DB'den sil (HTTP 410 Gone)
              if (e.statusCode === 410 || e.statusCode === 404) {
                supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).then();
              }
            });
          })
        );
      }
    }

    return NextResponse.json({ success: true, sentCount: tenantIds.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
