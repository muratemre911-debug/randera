import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { likeToggleSchema, validateRequest } from "@/lib/validations";

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
    const validation = validateRequest(likeToggleSchema, { postId });
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data: existingLike, error: checkError } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    let liked = false;

    if (existingLike) {
      const { error: deleteError } = await supabase
        .from("post_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) throw deleteError;
      liked = false;
    } else {
      const { error: insertError } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });

      if (insertError) throw insertError;
      liked = true;
    }

    const { count, error: countError } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    if (countError) throw countError;
    const likeCount = count || 0;

    return NextResponse.json({ success: true, liked, likeCount });
  } catch (err: any) {
    console.error("Like toggle error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}