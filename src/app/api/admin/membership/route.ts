import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createClient as createServerClient,
  createAdminClient,
} from "@/utils/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import {
  MONTHLY_DAYS,
  TRIAL_DAYS,
  getMembership,
  shiftEndDate,
  type MembershipStatus,
} from "@/lib/membership";
import { generateBaseSlug, generateUniqueSlug } from "@/lib/slug";
import {
  PROTECTED_TENANT_ERROR,
  isProtectedTenant,
} from "@/lib/protectedTenant";
import { adminMembershipSchema, validateRequest } from "@/lib/validations";

interface TenantMembershipRow {
  membership_status: string | null;
  trial_ends_at: string | null;
  membership_ends_at: string | null;
}

const SELECT = "membership_status, trial_ends_at, membership_ends_at";

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
    }

    const validation = validateRequest(adminMembershipSchema, await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { action, userId, days, tenantName, sector } = validation.data;

    const admin = createAdminClient();
    const now = new Date();
    let tenantId = validation.data.tenantId ?? null;
    let createdTenant = false;

    // Müşteri hesabına işletme yetkisi: önce işletme oluştur, profili sahiplendir
    if (!tenantId && userId) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .single();
      if (profileError) throw profileError;
      if (profile?.tenant_id) {
        return NextResponse.json(
          { error: "Bu hesabın zaten bir işletmesi var." },
          { status: 400 },
        );
      }

      const slug = await generateUniqueSlug(
        admin,
        generateBaseSlug(tenantName!),
      );
      const { data: created, error: createError } = await admin
        .from("tenants")
        .insert({ name: tenantName, slug, sector, is_active: true })
        .select("id")
        .single();
      if (createError) throw createError;
      tenantId = created.id;
      createdTenant = true;

      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ tenant_id: tenantId, role: "owner" })
        .eq("id", userId);
      if (profileUpdateError) throw profileUpdateError;
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Hedef işletme bulunamadı." },
        { status: 400 },
      );
    }

    // Süper admin işletmesi: sınırsız üyelik, işlem yapılamaz
    if (await isProtectedTenant(tenantId)) {
      if (!createdTenant) {
        return NextResponse.json(
          { error: PROTECTED_TENANT_ERROR },
          { status: 403 },
        );
      }
      // Yeni oluşturulan işletme süper admine aitse işlem uygulanmaz; sınırsız kalır.
      const { data: unlimited } = await admin
        .from("tenants")
        .select(`${SELECT}, is_active`)
        .eq("id", tenantId)
        .single();
      return NextResponse.json({
        success: true,
        tenantId,
        isActive: unlimited?.is_active ?? true,
        membership: getMembership(
          (unlimited ?? {}) as TenantMembershipRow,
          now,
        ),
      });
    }

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .select(SELECT)
      .eq("id", tenantId)
      .single();
    if (tenantError) throw tenantError;

    const current = tenant as TenantMembershipRow;
    const patch: Record<string, unknown> = {};

    switch (action) {
      case "load-trial": {
        const status: MembershipStatus =
          getMembership(current, now).kind === "active" ? "active" : "trial";
        patch.trial_ends_at = shiftEndDate(
          current.trial_ends_at,
          TRIAL_DAYS,
          now,
        );
        patch.membership_status = status;
        break;
      }
      case "load-monthly":
      case "load-custom": {
        const add = action === "load-monthly" ? MONTHLY_DAYS : days!;
        patch.membership_ends_at = shiftEndDate(
          current.membership_ends_at,
          add,
          now,
        );
        patch.membership_status = "active" satisfies MembershipStatus;
        break;
      }
      case "adjust": {
        // Süresi işleyen alanı (üyelik varsa üyelik, yoksa deneme) kaydır
        const info = getMembership(current, now);
        if (info.kind === "active") {
          patch.membership_ends_at = shiftEndDate(
            current.membership_ends_at,
            days!,
            now,
          );
        } else {
          patch.trial_ends_at = shiftEndDate(current.trial_ends_at, days!, now);
        }
        break;
      }
      case "suspend":
        patch.membership_status = "suspended" satisfies MembershipStatus;
        patch.is_active = false;
        break;
      case "activate": {
        const restored = getMembership(
          { ...current, membership_status: "active" },
          now,
        );
        patch.membership_status = (
          restored.kind === "trial" ? "trial" : "active"
        ) satisfies MembershipStatus;
        patch.is_active = true;
        break;
      }
    }

    const { error: updateError } = await admin
      .from("tenants")
      .update(patch)
      .eq("id", tenantId);
    if (updateError) throw updateError;

    const { data: updated } = await admin
      .from("tenants")
      .select(`${SELECT}, is_active`)
      .eq("id", tenantId)
      .single();

    revalidatePath("/discover", "page");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/", "layout");

    return NextResponse.json({
      success: true,
      tenantId,
      isActive: updated?.is_active ?? null,
      membership: getMembership(
        (updated ?? current) as TenantMembershipRow,
        now,
      ),
    });
  } catch (err) {
    console.error(
      "admin membership error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Beklenmeyen hata" },
      { status: 500 },
    );
  }
}
