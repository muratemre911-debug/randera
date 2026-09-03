import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import webpush from "web-push";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { bookAppointmentSchema, validateRequest } from "@/lib/validations";

const DAY_NAME_TO_SLOT: Record<string, string> = {
  Mon: "pazartesi",
  Tue: "sali",
  Wed: "carsamba",
  Thu: "persembe",
  Fri: "cuma",
  Sat: "cumartesi",
  Sun: "pazar",
};

interface WorkingDay {
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
}

function getWeekdayInTr(d: Date): string {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(d);
  return DAY_NAME_TO_SLOT[short] || "";
}

function getTimeOfDay(d: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  let h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  if (h === 24) h = 0;
  return { h, m };
}

function toMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await req.json();
    const validation = validateRequest(bookAppointmentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { tenant_id, service_id, start_time, end_time, note } = validation.data;

    const start = new Date(start_time);
    const end = new Date(end_time);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Geçersiz randevu zamanı." }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json({ error: "Bitiş zamanı başlangıç zamanından sonra olmalı." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Hizmetin bu işletmeye ait ve aktif olduğunu doğrula
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, tenant_id, is_active")
      .eq("id", service_id)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Hizmet bulunamadı." }, { status: 404 });
    }

    if (service.tenant_id !== tenant_id) {
      return NextResponse.json({ error: "Seçilen hizmet bu işletmeye ait değil." }, { status: 400 });
    }

    if (service.is_active === false) {
      return NextResponse.json({ error: "Bu hizmet şu anda randevu almaya kapalı." }, { status: 400 });
    }

    // Çalışma saatleri doğrulama
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("working_hours")
      .eq("id", tenant_id)
      .single();

    const workingHours = tenant?.working_hours as Record<string, WorkingDay> | null;

    if (workingHours) {
      const dayName = getWeekdayInTr(start);
      const day = workingHours[dayName];

      if (day && day.isOpen === false) {
        return NextResponse.json({ error: "Bu gün işletme kapalı." }, { status: 409 });
      }

      if (day && day.isOpen === true) {
        const openMin = toMinutes(day.openTime);
        const closeMin = toMinutes(day.closeTime);
        const startMin = getTimeOfDay(start).h * 60 + getTimeOfDay(start).m;
        const endMin = getTimeOfDay(end).h * 60 + getTimeOfDay(end).m;

        if (openMin !== null && startMin < openMin) {
          return NextResponse.json({ error: "Randevu çalışma saatleri dışında." }, { status: 409 });
        }
        if (closeMin !== null && endMin > closeMin) {
          return NextResponse.json({ error: "Randevu çalışma saatleri dışında." }, { status: 409 });
        }
      }
    }

    // Çakışma kontrolü (iptal edilmiş randevular hariç)
    const { data: conflicts } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("tenant_id", tenant_id)
      .neq("status", "cancelled")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "Bu zaman aralığı zaten dolu." }, { status: 409 });
    }

    // Müşteri adını ve telefonunu sunucu tarafında çek
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, avatar_url")
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
      custom_fields: {
        customer_name: customerName,
        note: note || "",
        phone: customerPhone,
        avatar_url: profile?.avatar_url || "",
      },
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