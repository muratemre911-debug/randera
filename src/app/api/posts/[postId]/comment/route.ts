import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createCommentSchema, validateRequest } from "@/lib/validations";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const { postId } = await params;
    const body = await req.json();
    const validation = validateRequest(createCommentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { text } = validation.data;

    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, full_name")
      .eq("id", user.id)
      .single();

    const username = profile?.nickname || profile?.full_name || "Kullanıcı";

    const { data: comment, error: insertError } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        username,
        text,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { count, error: countError } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    if (countError) throw countError;
    const commentCount = count || 0;

    return NextResponse.json({ success: true, comment, commentCount });
  } catch (err: any) {
    console.error("Add comment error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}