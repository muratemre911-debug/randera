import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];

async function checkAuth() {
  const supabaseUser = await createServerClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
    throw new Error("Yetkisiz işlem. Süper Admin değilsiniz.");
  }
}

export async function GET() {
  try {
    await checkAuth();
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: customers, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id, full_name, created_at, role, phone
      `)
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (profileError) throw profileError;

    const { data: appointments, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("customer_id");
      
    const apptMap = new Map();
    if (!apptError && appointments) {
      appointments.forEach(a => {
        apptMap.set(a.customer_id, (apptMap.get(a.customer_id) || 0) + 1);
      });
    }

    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const userMap = new Map();
    authUsers.users.forEach(u => userMap.set(u.id, u.email));

    const result = customers
      .filter((c: any) => userMap.has(c.id)) // Sadece auth.users'da kaydı olan GERÇEK kullanıcıları filtrele
      .map((c: any) => {
      return {
        id: c.id,
        fullName: c.full_name || "Bilinmiyor",
        createdAt: c.created_at,
        email: userMap.get(c.id) || "Bulunamadı",
        phone: c.phone || "-",
        appointmentCount: apptMap.get(c.id) || 0
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
