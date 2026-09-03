import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = await createServerClient();

    const { data: comments, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    if (!comments || comments.length === 0) {
      return NextResponse.json([]);
    }

    const userIds = [...new Set(comments.map((c) => c.user_id))];

    const supabaseAdmin = createAdminClient();

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, avatar_url, nickname, full_name")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [
        p.id,
        {
          avatar_url: p.avatar_url,
          nickname: p.nickname,
          full_name: p.full_name,
        },
      ])
    );

    const commentsWithAvatars = comments.map((comment) => {
      const profile = profileMap.get(comment.user_id);
      return {
        ...comment,
        username: comment.username || profile?.nickname || profile?.full_name || "Kullanıcı",
        avatar_url: profile?.avatar_url || null,
      };
    });

    return NextResponse.json(commentsWithAvatars);
  } catch (err: any) {
    console.error("Fetch comments error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
