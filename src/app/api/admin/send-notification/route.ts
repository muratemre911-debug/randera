import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import webpush from "web-push";
import { sendNotificationSchema, validateRequest } from "@/lib/validations";
import { isSuperAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateRequest(sendNotificationSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { title, message, targetType, targetValue } = validation.data;

    const supabaseAdmin = createAdminClient();

    // Hangi tenantlara gideceğini belirle
    let tenantIds: string[] = [];

    if (targetType === "all") {
      const { data } = await supabaseAdmin.from("tenants").select("id");
      tenantIds = data?.map(t => t.id) || [];
    } else if (targetType === "sector") {
      const { data } = await supabaseAdmin.from("tenants").select("id").eq("sector", targetValue);
      tenantIds = data?.map(t => t.id) || [];
    } else if (targetType === "single") {
      tenantIds = [targetValue!];
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
