import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next");

  // Determine base URL (accounting for load balancers / reverse proxies in production)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const targetBase = isLocalEnv
    ? origin
    : forwardedHost
    ? `https://${forwardedHost}`
    : origin;

  if (error) {
    console.error("OAuth error received in callback:", error, errorDescription);
    const errorMsg = errorDescription || error;
    return NextResponse.redirect(`${targetBase}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth code exchange error:", exchangeError);
      return NextResponse.redirect(
        `${targetBase}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    const user = data.user;
    if (user) {
      const supabaseAdmin = createAdminClient();

      // Check if a profile exists for this user
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role, tenant_id, avatar_url, full_name, nickname")
        .eq("id", user.id)
        .maybeSingle();

      let userRole = existingProfile?.role;

      if (!existingProfile) {
        // User logged in via OAuth for the first time
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Kullanıcı";

        const avatarUrl =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        // Clean up any default tenant created by an automatic database trigger
        const { data: autoProfile } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .maybeSingle();

        if (autoProfile?.tenant_id) {
          await supabaseAdmin.from("tenants").delete().eq("id", autoProfile.tenant_id);
        }

        // Generate a valid, unique nickname
        let baseNick = (
          user.user_metadata?.preferred_username ||
          user.email?.split("@")[0] ||
          "user"
        )
          .toLowerCase()
          .replace(/[^a-z0-9._]/g, "")
          .slice(0, 20);

        if (baseNick.length < 3) {
          baseNick = `user_${baseNick}`;
        }

        let uniqueNickname = baseNick;
        const { data: existingNick } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("nickname", uniqueNickname)
          .maybeSingle();

        if (existingNick) {
          uniqueNickname = `${baseNick.slice(0, 15)}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Create profile with customer role
        const { error: insertError } = await supabaseAdmin.from("profiles").upsert({
          id: user.id,
          full_name: fullName,
          nickname: uniqueNickname,
          avatar_url: avatarUrl,
          role: "customer",
          tenant_id: null,
          is_active: true,
        });

        if (insertError) {
          console.error("Error creating profile for OAuth user:", insertError);
        }

        userRole = "customer";
      } else {
        // Existing user: if they don't have an avatar yet, update with Google avatar
        const googleAvatar =
          user.user_metadata?.avatar_url || user.user_metadata?.picture;
        if (!existingProfile.avatar_url && googleAvatar) {
          await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: googleAvatar })
            .eq("id", user.id);
        }
      }

      // If user specified a safe return path (like a booking page)
      if (next && next.startsWith("/") && !next.startsWith("/login")) {
        return NextResponse.redirect(`${targetBase}${next}`);
      }

      // Default redirect based on role
      const destination = userRole === "customer" ? "/discover" : "/dashboard";
      return NextResponse.redirect(`${targetBase}${destination}`);
    }
  }

  return NextResponse.redirect(`${targetBase}/login?error=auth_callback_failed`);
}
