import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const { tenant_id, service_id, start_time, end_time, note } = await req.json();

    if (!tenant_id || !service_id || !start_time || !end_time) {
      return NextResponse.json({ error: "Eksik randevu bilgisi." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Müşteri adını ve telefonunu sunucu tarafında çek
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    const customerName = profile?.full_name || "Bir müşteri";
    const customerPhone = profile?.phone || "";

    // 1. Randevuyu kaydet (RLS'yi atlar)
    const { error: apptError } = await supabaseAdmin.from("appointments").insert({
      tenant_id,
      customer_id: user.id,
      service_id,
      start_time,
      end_time,
      status: "confirmed",
      custom_fields: { customer_name: customerName, note: note || "", phone: customerPhone },
    });

    if (apptError) {
      return NextResponse.json({ error: apptError.message }, { status: 500 });
    }

    // 2. İşletmeye in-app bildirim kaydet
    const message = `${customerName} tarafından ${format(new Date(start_time), "dd MMM yyyy HH:mm", { locale: tr })} için yeni bir randevu oluşturuldu.`;

    const { error: notifError } = await supabaseAdmin.from("notifications").insert({
      tenant_id,
      title: "Yeni Randevu",
      message,
      is_read: false,
    });

    if (notifError) {
      console.error("Notification insert error:", notifError);
    }

    // 3. Web Push ile cihaz bildirimi gönder
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(
        "mailto:test@example.com",
        vapidPublic,
        vapidPrivate
      );

      const { data: subscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("tenant_id", tenant_id);

      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({ title: "Yeni Randevu", body: message });

        await Promise.allSettled(
          subscriptions.map((sub) => {
            const pushSub = {
              endpoint: sub.endpoint,
              keys: {
                auth: sub.auth,
                p256dh: sub.p256dh,
              },
            };
            return webpush.sendNotification(pushSub, payload).catch((e: any) => {
              if (e.statusCode === 410 || e.statusCode === 404) {
                supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).then();
              }
            });
          })
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
