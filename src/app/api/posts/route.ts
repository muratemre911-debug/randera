import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";

async function getTenantId(userId: string) {
  const supabaseAdmin = createAdminClient();
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

    const supabaseUser = await createServerClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    const supabaseAdmin = createAdminClient();

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // If user is authenticated, check which posts they've liked
    if (user && posts && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: userLikes } = await supabaseAdmin
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);

      const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);
      
      const postsWithLikeStatus = posts.map(post => ({
        ...post,
        user_has_liked: likedPostIds.has(post.id),
      }));

      return NextResponse.json(postsWithLikeStatus);
    }

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

    const supabaseAdmin = createAdminClient();

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

    const supabaseAdmin = createAdminClient();

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
