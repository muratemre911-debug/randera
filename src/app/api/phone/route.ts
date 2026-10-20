import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { inspectTrMobile, trMobileErrorMessage } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Oturumdaki kullanıcının telefon numarasını doğrulayıp kaydeder.
 *
 * Neden sunucu tarafı:
 *   - "Bir numara yalnızca bir hesapta" kuralı, BAŞKA profillerin numaralarını
 *     okumayı gerektirir; RLS buna izin vermez.
 *   - İstemciden gelen numara burada yeniden doğrulanır (bkz. src/lib/phone.ts).
 *
 * Gövde: { phone: string }
 * Başarı: { success: true, phone: "05XXXXXXXXX" }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const check = inspectTrMobile(body?.phone);

    if (!check.ok) {
      return NextResponse.json(
        { error: trMobileErrorMessage(check.issue), issue: check.issue },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: owner } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", check.phone)
      .neq("id", user.id)
      .maybeSingle();

    if (owner) {
      return NextResponse.json(
        {
          error:
            "Bu telefon numarası başka bir hesapta kayıtlı. Bir numara yalnızca tek hesapta kullanılabilir.",
          issue: "taken",
        },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ phone: check.phone })
      .eq("id", user.id);

    if (updateError) {
      // 23505: benzersizlik ihlali — aynı anda başka bir hesap aynı numarayı aldı
      if (updateError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Bu telefon numarası başka bir hesapta kayıtlı. Bir numara yalnızca tek hesapta kullanılabilir.",
            issue: "taken",
          },
          { status: 409 },
        );
      }
      throw updateError;
    }

    return NextResponse.json({ success: true, phone: check.phone });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.";
    return NextResponse.json(
      { error: "Telefon numarası kaydedilemedi: " + message },
      { status: 500 },
    );
  }
}
