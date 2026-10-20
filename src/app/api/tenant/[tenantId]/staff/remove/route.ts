import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createClient as createServerClient,
  createAdminClient,
} from "@/utils/supabase/server";
import { isSuperAdmin } from "@/lib/admin";

const removeMemberSchema = z.object({
  memberId: z.string().uuid("Geçersiz üye ID"),
});

/**
 * Ekipten eleman çıkarma (yalnızca işletme sahibi / süper admin).
 *
 * NEDEN SUNUCU TARAFINDA:
 * `profiles` üzerindeki RLS, sahibin BAŞKA bir kullanıcının satırını
 * güncellemesine izin vermeyebilir. Bu durumda istemciden yapılan
 * `update` sessizce 0 satır etkiler ve Supabase HATA DÖNDÜRMEZ; arayüz üyeyi
 * listeden düşürür ama veritabanı hiç değişmez — eleman işletmede kalır ve
 * tüm yetkilerini korur. Bu uç service-role ile yazar, ardından yazdığını
 * geri okuyup doğrular; başarısızlık sessiz kalmaz.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;

    const supabaseUser = await createServerClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Giriş yapmanız gerekiyor." },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = removeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." },
        { status: 400 },
      );
    }
    const { memberId } = parsed.data;

    const admin = createAdminClient();

    // İsteği yapan: bu işletmenin sahibi mi?
    const { data: caller } = await admin
      .from("profiles")
      .select("id, role, tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    const callerIsOwner =
      caller?.role === "owner" && caller?.tenant_id === tenantId;

    if (!callerIsOwner && !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: "Bu işlem için işletme sahibi olmalısınız." },
        { status: 403 },
      );
    }

    // Hedef üye: aynı işletmede ve eleman olmalı
    const { data: member } = await admin
      .from("profiles")
      .select("id, role, tenant_id, full_name")
      .eq("id", memberId)
      .maybeSingle();

    if (!member || member.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: "Bu kişi bu işletmenin ekibinde değil." },
        { status: 404 },
      );
    }

    if (member.role === "owner") {
      return NextResponse.json(
        { error: "İşletme sahibi ekipten çıkarılamaz." },
        { status: 400 },
      );
    }

    if (member.id === user.id) {
      return NextResponse.json(
        { error: "Kendinizi ekipten çıkaramazsınız." },
        { status: 400 },
      );
    }

    // Hizmetler sahipsiz kalmasın: işletme sahibine devret
    const { data: owner } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (owner?.id) {
      await admin
        .from("services")
        .update({ staff_id: owner.id })
        .eq("tenant_id", tenantId)
        .eq("staff_id", member.id);
    }

    // Üyelikten çıkar: rol müşteriye döner, işletme bağı kopar
    const { error: updateError } = await admin
      .from("profiles")
      .update({ role: "customer", tenant_id: null })
      .eq("id", member.id);

    if (updateError) {
      console.error("Remove member update error:", updateError);
      return NextResponse.json(
        { error: `Çıkarılamadı: ${updateError.message}` },
        { status: 500 },
      );
    }

    // SAĞLAMA: yazdığımızı geri okuyup doğrula. (İstemci tarafında bu adım
    // olmadığı için başarısız çıkarma "başarılı" gibi görünüyordu.)
    const { data: after } = await admin
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", member.id)
      .maybeSingle();

    if (after?.role !== "customer" || after?.tenant_id !== null) {
      console.error("Remove member verification failed:", { memberId, after });
      return NextResponse.json(
        { error: "Eleman çıkarılamadı; kayıt değişmedi." },
        { status: 500 },
      );
    }

    // Elemana özel ayarları temizle (yeniden davet edilirse eski saat/kurallar
    // geri gelmesin). Satır yoksa sorun değil.
    const { error: settingsError } = await admin
      .from("staff_settings")
      .delete()
      .eq("profile_id", member.id);

    if (settingsError) {
      // Üyelik zaten kaldırıldı; ayar temizliği başarısız olsa da işlem biter.
      console.error("Remove member settings cleanup error:", settingsError);
    }

    return NextResponse.json({
      success: true,
      memberId: member.id,
      name: member.full_name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sunucu hatası";
    console.error("Remove member error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
