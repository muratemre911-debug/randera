import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function getTenantId(userId: string) {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .single();
  return profile;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id gerekli." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(posts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const profile = await getTenantId(user.id);
    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Bu işlem için bir işletme hesabınız olmalı." }, { status: 403 });
    }

    const { image_url, description } = await req.json();
    if (!image_url) {
      return NextResponse.json({ error: "Fotoğraf gerekli." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .insert({ tenant_id: profile.tenant_id, image_url, description: description || "" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, post });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const profile = await getTenantId(user.id);
    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Bu işlem için bir işletme hesabınız olmalı." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Gönderi ID gerekli." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", id)
      .eq("tenant_id", profile.tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
