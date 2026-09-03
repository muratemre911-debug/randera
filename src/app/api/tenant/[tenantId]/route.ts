import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;

    const supabaseAdmin = createAdminClient();

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, profile_image_url, cover_image_url")
      .eq("id", tenantId)
      .single();

    if (error) throw error;

    return NextResponse.json({ tenant });
  } catch (err: any) {
    console.error("Fetch tenant error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}