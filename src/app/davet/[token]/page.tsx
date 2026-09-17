import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Ekip Daveti - Randera",
  robots: "noindex, nofollow",
};

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

/** Davet linki tek kullanımlık: kabul edildiğinde tükenir. */
export default async function DavetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Giriş yapılmamışsa akış kopmaz: giriş/kayıt sonrası aynı davete dönülür.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/davet/${token}`)}`);
  }

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("staff_invites")
    .select("id, tenant_id, status, expires_at, accepted_by")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <InviteNotice
        title="Davet bulunamadı"
        message="Bu davet linki geçersiz. Lütfen işletme sahibinden yeni bir davet linki isteyin."
      />
    );
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", invite.tenant_id)
    .single();

  const businessName = tenant?.name ?? "İşletme";

  // Zaten kabul edilmiş (bu kullanıcı veya bir başkası)
  if (invite.status === "accepted") {
    if (invite.accepted_by === user.id) {
      redirect("/dashboard?davet=kabul");
    }
    return (
      <InviteNotice
        title="Davet kullanılmış"
        message={`Bu davet linki daha önce kabul edilmiş. ${businessName} ekibine katılmak için işletme sahibinden yeni bir link isteyin.`}
      />
    );
  }

  if (invite.status === "revoked") {
    return (
      <InviteNotice
        title="Davet iptal edildi"
        message={`${businessName} bu daveti iptal etmiş. Güncel bir davet linki isteyin.`}
      />
    );
  }

  if (isExpired(invite.expires_at)) {
    return (
      <InviteNotice
        title="Davetin süresi doldu"
        message={`Bu davet linkinin süresi dolmuş. ${businessName} işletmesinden yeni bir davet isteyin.`}
      />
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  // Kendi işletmesi olan biri eleman olarak ekibe katılamaz (rolü bozulurdu).
  if (profile?.role === "owner" && profile.tenant_id) {
    return (
      <InviteNotice
        title="Bu hesap bir işletme sahibi"
        message={`${businessName} ekibine katılmak için işletme sahibi olmayan bir hesapla giriş yapın.`}
      />
    );
  }

  // Otomatik kabul: ekibe dahil et ve panele yönlendir.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: "staff", tenant_id: invite.tenant_id })
    .eq("id", user.id);

  if (profileError) {
    return (
      <InviteNotice
        title="Katılım tamamlanamadı"
        message="Bir hata oluştu, lütfen birkaç dakika sonra tekrar deneyin."
      />
    );
  }

  await admin
    .from("staff_invites")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "pending");

  redirect("/dashboard?davet=kabul");
}

function InviteNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="page-fill flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/70 p-8 text-center shadow-xl shadow-black/5 backdrop-blur-2xl">
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-purple-700"
        >
          Panele Dön
        </Link>
      </div>
    </div>
  );
}
