import { NextResponse } from "next/server";
import {
  createClient as createServerClient,
  createAdminClient,
} from "@/utils/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getMembership } from "@/lib/membership";

export interface AdminAccount {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  phone: string | null;
  createdAt: string | null;
  tenantId: string | null;
  tenantName: string | null;
  sector: string | null;
  tenantIsActive: boolean | null;
  membership: ReturnType<typeof getMembership>;
  appointmentCount: number;
}

/** auth.users tablosunu sayfalayarak tamamını çeker (varsayılan sayfa 50 ile sınırlı). */
async function fetchAllEmails(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const perPage = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    users.forEach((u) => {
      if (u.email) emails.set(u.id, u.email);
    });
    if (users.length < perPage) break;
  }

  return emails;
}

export async function GET() {
  try {
    const supabaseUser = await createServerClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
    }

    const admin = createAdminClient();

    const [
      { data: profiles, error: profileError },
      { data: tenants, error: tenantError },
      { data: appointments },
      emails,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, role, phone, created_at, tenant_id")
        .order("created_at", { ascending: false }),
      admin
        .from("tenants")
        .select(
          "id, name, sector, is_active, membership_status, trial_ends_at, membership_ends_at",
        ),
      admin.from("appointments").select("customer_id"),
      fetchAllEmails(admin),
    ]);

    if (profileError) throw profileError;
    if (tenantError) throw tenantError;

    type TenantRow = {
      id: string;
      name: string;
      sector: string | null;
      is_active: boolean | null;
      membership_status: string | null;
      trial_ends_at: string | null;
      membership_ends_at: string | null;
    };

    const tenantMap = new Map<string, TenantRow>(
      ((tenants ?? []) as TenantRow[]).map((t) => [t.id, t]),
    );

    const appointmentCounts = new Map<string, number>();
    (appointments ?? []).forEach((a: { customer_id: string | null }) => {
      if (!a.customer_id) return;
      appointmentCounts.set(
        a.customer_id,
        (appointmentCounts.get(a.customer_id) || 0) + 1,
      );
    });

    const accounts: AdminAccount[] = (profiles ?? []).flatMap((p) => {
      const email = emails.get(p.id);
      if (!email) return []; // auth kaydı olmayan (silinmiş) profilleri atla

      const tenant = p.tenant_id ? tenantMap.get(p.tenant_id) : undefined;
      return [
        {
          userId: p.id,
          fullName: p.full_name || "İsimsiz",
          email,
          role: p.role || "customer",
          phone: p.phone || null,
          createdAt: p.created_at,
          tenantId: tenant?.id ?? null,
          tenantName: tenant?.name ?? null,
          sector: tenant?.sector ?? null,
          tenantIsActive: tenant?.is_active ?? null,
          membership: getMembership({
            membership_status: tenant?.membership_status,
            trial_ends_at: tenant?.trial_ends_at,
            membership_ends_at: tenant?.membership_ends_at,
          }),
          appointmentCount: appointmentCounts.get(p.id) || 0,
        },
      ];
    });

    return NextResponse.json(accounts);
  } catch (err) {
    console.error(
      "admin accounts error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Beklenmeyen hata" },
      { status: 500 },
    );
  }
}
