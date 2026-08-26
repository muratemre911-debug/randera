import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabaseAdmin.from("sectors").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
      return NextResponse.json({ error: "Yetkisiz işlem. Yalnızca süper admin sektör ekleyebilir." }, { status: 403 });
    }

    const { name, value } = await req.json();
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabaseAdmin.from("sectors").insert({ name, value }).select().single();
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
      return NextResponse.json({ error: "Yetkisiz işlem. Yalnızca süper admin sektör silebilir." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Silinecek ID gerekli" }, { status: 400 });

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabaseAdmin.from("sectors").delete().eq("id", id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
