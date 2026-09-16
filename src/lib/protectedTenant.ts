import { createAdminClient } from "@/utils/supabase/server";
import { SUPER_ADMIN_EMAILS } from "@/lib/admin";
import { isUnlimitedStatus } from "@/lib/membership";

export const PROTECTED_TENANT_ERROR =
  "Süper admin hesabının işletmesi korunuyor: üyelik işlemleri ve silme devre dışı.";

/**
 * Süper admin hesabına ait işletme mi?
 * Bu işletmeler sınırsız üyeliklidir; panelden süre yükleme/düşürme, kapatma ve
 * silme işlemleri reddedilir. Env ile eklenen adminler için kendini onarır:
 * ilk kontrolün ardından işletme 'unlimited' olarak işaretlenir.
 */
export async function isProtectedTenant(tenantId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("membership_status")
    .eq("id", tenantId)
    .maybeSingle();

  if (isUnlimitedStatus(tenant)) return true;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId);

  for (const profile of profiles ?? []) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    const email = data?.user?.email?.toLowerCase();
    if (email && SUPER_ADMIN_EMAILS.includes(email)) {
      await admin
        .from("tenants")
        .update({
          membership_status: "unlimited",
          membership_ends_at: null,
          trial_ends_at: null,
        })
        .eq("id", tenantId);
      return true;
    }
  }

  return false;
}
