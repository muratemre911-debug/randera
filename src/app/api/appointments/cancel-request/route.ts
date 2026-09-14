import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import { z } from "zod";

const cancelRequestSchema = z.object({
  appointment_id: z.string().uuid("Geçersiz randevu ID"),
  reason: z.string().max(500, "Açıklama en fazla 500 karakter olmalı").optional(),
});

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = cancelRequestSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { appointment_id, reason } = parsed.data;
    const supabaseAdmin = createAdminClient();

    // Randevuyu çek ve sahipliği doğrula
    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("id, customer_id, tenant_id, service_id, start_time, status, custom_fields")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) {
      return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
    }

    if (appt.customer_id !== user.id) {
      return NextResponse.json({ error: "Bu randevu size ait değil." }, { status: 403 });
    }

    if (appt.status === "cancelled") {
      return NextResponse.json({ error: "Bu randevu zaten iptal edilmiş." }, { status: 409 });
    }

    if (new Date(appt.start_time).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Geçmiş randevular için istek gönderilemez." }, { status: 409 });
    }

    const prevFields = (appt.custom_fields || {}) as Record<string, unknown>;
    if (prevFields.cancel_requested === true) {
      return NextResponse.json({ error: "Bu randevu için zaten bir iptal isteği gönderilmiş." }, { status: 409 });
    }

    // İstek bayrağını randevuya işle
    const { error: updateError } = await supabaseAdmin
      .from("appointments")
      .update({
        custom_fields: {
          ...prevFields,
          cancel_requested: true,
          cancel_reason: reason || "",
          cancel_requested_at: new Date().toISOString(),
        },
      })
      .eq("id", appointment_id);

    if (updateError) {
      return NextResponse.json({ error: "İstek kaydedilemedi: " + updateError.message }, { status: 500 });
    }

    // İşletmeye bildirim bırak
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("name")
      .eq("id", appt.service_id)
      .single();

    const customerName = (profile?.full_name as string) || "Bir müşteri";
    const serviceName = (service?.name as string) || "Randevu";
    const startStr = new Date(appt.start_time).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `${customerName}, ${startStr} tarihli ${serviceName} randevusu için iptal talebinde bulundu.${reason ? ` Sebep: ${reason}` : ""}`;

    const { error: notifError } = await supabaseAdmin.from("notifications").insert({
      tenant_id: appt.tenant_id,
      title: "Randevu İptal Talebi",
      message,
      is_read: false,
    });

    if (notifError) {
      console.error("Cancel-request notification insert error:", notifError);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Cancel-request error:", err);
    return NextResponse.json({ error: err.message || "Bir hata oluştu." }, { status: 500 });
  }
}

// İptal isteğini geri çek (müşteri vazgeçti)
export async function DELETE(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const appointment_id = searchParams.get("appointment_id");

    if (!appointment_id) {
      return NextResponse.json({ error: "Randevu ID gerekli." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("id, customer_id, tenant_id, service_id, start_time, status, custom_fields")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) {
      return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
    }

    if (appt.customer_id !== user.id) {
      return NextResponse.json({ error: "Bu randevu size ait değil." }, { status: 403 });
    }

    const prevFields = (appt.custom_fields || {}) as Record<string, unknown>;
    if (prevFields.cancel_requested !== true) {
      return NextResponse.json({ error: "Bu randevu için aktif bir iptal isteği yok." }, { status: 409 });
    }

    const { cancel_requested, cancel_reason, cancel_requested_at, ...rest } = prevFields;

    const { error: updateError } = await supabaseAdmin
      .from("appointments")
      .update({ custom_fields: rest })
      .eq("id", appointment_id);

    if (updateError) {
      return NextResponse.json({ error: "İstek geri çekilemedi: " + updateError.message }, { status: 500 });
    }

    // İşletmeye bilgi notu bırak
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("name")
      .eq("id", appt.service_id)
      .single();

    const customerName = (profile?.full_name as string) || "Bir müşteri";
    const serviceName = (service?.name as string) || "Randevu";
    const startStr = new Date(appt.start_time).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const { error: notifError } = await supabaseAdmin.from("notifications").insert({
      tenant_id: appt.tenant_id,
      title: "İptal Talebi Geri Çekildi",
      message: `${customerName}, ${startStr} tarihli ${serviceName} randevusu için gönderdiği iptal talebini geri çekti. Randevu geçerliliğini koruyor.`,
      is_read: false,
    });

    if (notifError) {
      console.error("Cancel-withdraw notification insert error:", notifError);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Cancel-withdraw error:", err);
    return NextResponse.json({ error: err.message || "Bir hata oluştu." }, { status: 500 });
  }
}
