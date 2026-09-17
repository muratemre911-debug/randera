"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Crown,
  ShieldCheck,
  MessageCircle,
  Link2,
  Loader2,
  Clock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import InlineAlert from "@/components/ui/InlineAlert";
import {
  buildWhatsAppInviteUrl,
  sortStaffOwnerFirst,
  type StaffMember,
} from "@/lib/staff";

interface Invite {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export default function EkipPage() {
  const supabase = createClient();
  const { lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [origin, setOrigin] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** İşlem hataları: `alert()` yerine sayfa içinde gösterilir. */
  const [pageError, setPageError] = useState<string | null>(null);
  /** Üye çıkarma onayı: `confirm()` yerine uygulama içi diyalog. */
  const [pendingRemove, setPendingRemove] = useState<StaffMember | null>(null);
  /** Davet iptali onayı (id). */
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Link paylaşılır (WhatsApp/başka cihaz): origin sadece yedek, localhost paylaşılamaz.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin;
  const inviteUrl = (token: string) =>
    baseUrl ? `${baseUrl}/davet/${token}` : `/davet/${token}`;
  const shareable =
    baseUrl !== "" &&
    !/\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(baseUrl);

  const loadRoster = async (tid: string) => {
    const [{ data: memberData }, { data: inviteData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("tenant_id", tid)
        .in("role", ["owner", "staff"])
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_invites")
        .select("id, token, created_at, expires_at")
        .eq("tenant_id", tid)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (memberData) setMembers(memberData as StaffMember[]);
    if (inviteData) setInvites(inviteData as Invite[]);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- veri çekme; setState çağrıları await sonrasında çalışır
    setOrigin(window.location.origin);

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id || profile.role !== "owner") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setTenantId(profile.tenant_id);

      // `maybeSingle()`: işletme silinmişse veya RLS satırı gizliyorsa 0 satır
      // dönmesi hata olmamalı (PostgREST 406 üretiyordu).
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", profile.tenant_id)
        .maybeSingle();

      setTenantName(tenant?.name ?? "Randera");

      await loadRoster(profile.tenant_id);
      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tek seferlik ilk yükleme
  }, [supabase]);

  const sortedMembers = useMemo(() => sortStaffOwnerFirst(members), [members]);
  const ownerId = useMemo(
    () => members.find((m) => m.role === "owner")?.id ?? null,
    [members],
  );

  const handleCreateInvite = async () => {
    if (!tenantId) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("staff_invites")
      .insert({
        tenant_id: tenantId,
        invited_by: currentUserId,
        // Token istemcide üretilir: davet linkinin tahmin edilmesi imkansız olsun
        token: crypto.randomUUID(),
      })
      .select("id, token, created_at, expires_at")
      .single();

    if (error) {
      setPageError(
        (lang === "tr"
          ? "Davet oluşturulamadı: "
          : "Could not create invite: ") + error.message,
      );
    } else if (data) {
      setInvites((prev) => [data as Invite, ...prev]);
    }

    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    setPendingRevoke(null);
    setBusyId(id);
    const { error } = await supabase
      .from("staff_invites")
      .update({ status: "revoked" })
      .eq("id", id);

    if (!error) setInvites((prev) => prev.filter((i) => i.id !== id));
    setBusyId(null);
  };

  const handleCopy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setPageError(
        lang === "tr"
          ? "Bağlantı kopyalanamadı. Lütfen elle seçip kopyalayın."
          : "Could not copy the link. Please select and copy it manually.",
      );
    }
  };

  const handleRemoveMember = async (member: StaffMember) => {
    setPendingRemove(null);
    setBusyId(member.id);

    // Hizmetler sahipsiz kalmasın: işletme sahibine devret
    if (ownerId && ownerId !== member.id) {
      await supabase
        .from("services")
        .update({ staff_id: ownerId })
        .eq("staff_id", member.id);
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: "customer", tenant_id: null })
      .eq("id", member.id);

    if (error) {
      setPageError(
        (lang === "tr" ? "Çıkarılamadı: " : "Could not remove: ") +
          error.message,
      );
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    }

    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200/80 bg-white/80 p-10 text-center backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/70">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-slate-400" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          {lang === "tr" ? "Yetkiniz yok" : "Not authorized"}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {lang === "tr"
            ? "Ekip yönetimi yalnızca işletme sahibi tarafından kullanılabilir."
            : "Team management is only available to the business owner."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 w-full min-w-0">
      {pageError && (
        <InlineAlert kind="error" onDismiss={() => setPageError(null)}>
          {pageError}
        </InlineAlert>
      )}
      <ConfirmDialog
        open={pendingRemove !== null}
        destructive
        loading={busyId !== null}
        title={lang === "tr" ? "Ekipten çıkar" : "Remove from team"}
        message={
          lang === "tr"
            ? `${pendingRemove?.full_name ?? "Bu eleman"} ekibinizden çıkarılsın mı? Hizmetleri işletme sahibine devredilir.`
            : `Remove ${pendingRemove?.full_name ?? "this member"}? Their services will move to the business owner.`
        }
        confirmLabel={lang === "tr" ? "Çıkar" : "Remove"}
        cancelLabel={lang === "tr" ? "Vazgeç" : "Cancel"}
        onConfirm={() => pendingRemove && handleRemoveMember(pendingRemove)}
        onCancel={() => setPendingRemove(null)}
      />
      <ConfirmDialog
        open={pendingRevoke !== null}
        destructive
        loading={busyId !== null}
        title={lang === "tr" ? "Daveti iptal et" : "Revoke invite"}
        message={
          lang === "tr"
            ? "Bu davet bağlantısı iptal edilsin mi? Bağlantı artık çalışmayacak."
            : "Revoke this invite link? It will stop working."
        }
        confirmLabel={lang === "tr" ? "İptal Et" : "Revoke"}
        cancelLabel={lang === "tr" ? "Vazgeç" : "Cancel"}
        onConfirm={() => pendingRevoke && handleRevoke(pendingRevoke)}
        onCancel={() => setPendingRevoke(null)}
      />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {lang === "tr" ? "Ekip & Elemanlar" : "Team & Staff"}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {members.length}{" "}
            {lang === "tr" ? "kişi bu işletmede" : "people in this business"}
          </p>
        </div>

        <button
          onClick={handleCreateInvite}
          disabled={creating}
          className="flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <UserPlus size={18} strokeWidth={2.5} />
          )}
          {lang === "tr" ? "Eleman Davet Et" : "Invite Staff"}
        </button>
      </div>

      {/* Members */}
      <section className="space-y-3 w-full min-w-0">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {lang === "tr" ? "Ekip Üyeleri" : "Team Members"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 w-full min-w-0">
          {sortedMembers.map((member) => {
            const isOwner = member.role === "owner";
            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 rounded-3xl border p-4 backdrop-blur-2xl w-full min-w-0 overflow-hidden ${
                  isOwner
                    ? "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white/70 dark:border-amber-500/30 dark:from-amber-950/30 dark:to-slate-900/60"
                    : "border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70"
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt={member.full_name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (member.full_name ?? "?").charAt(0).toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-900 dark:text-white">
                    {member.full_name ??
                      (lang === "tr" ? "İsimsiz" : "Unnamed")}
                    {member.id === currentUserId && (
                      <span className="ml-2 text-xs font-medium text-slate-400">
                        {lang === "tr" ? "(siz)" : "(you)"}
                      </span>
                    )}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      isOwner
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    }`}
                  >
                    {isOwner ? <Crown size={12} /> : <Users size={12} />}
                    {isOwner
                      ? lang === "tr"
                        ? "İşletme Sahibi"
                        : "Business Owner"
                      : lang === "tr"
                        ? "Eleman"
                        : "Staff"}
                  </span>
                </div>

                {!isOwner && (
                  <button
                    onClick={() => setPendingRemove(member)}
                    disabled={busyId === member.id}
                    title={lang === "tr" ? "Ekipten çıkar" : "Remove from team"}
                    className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Pending invites */}
      <section className="space-y-3 w-full min-w-0">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {lang === "tr" ? "Bekleyen Davetler" : "Pending Invites"}
        </h2>

        {invites.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 w-full">
            {lang === "tr"
              ? "Aktif davet linki yok. “Eleman Davet Et” ile WhatsApp paylaşılabilir bir link oluşturun."
              : "No active invite links. Use “Invite Staff” to create a shareable link."}
          </div>
        ) : (
          <div className="grid gap-3 w-full min-w-0">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="w-full min-w-0 overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 to-white/70 p-4 backdrop-blur-2xl dark:border-indigo-500/25 dark:from-indigo-950/25 dark:to-slate-900/60 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
                  <div className="min-w-0 flex-1 w-full">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                      <Link2 size={16} className="text-indigo-500 shrink-0" />
                      <span className="truncate">
                        {lang === "tr"
                          ? "Davet linki hazır"
                          : "Invite link ready"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center rounded-xl border border-indigo-100/80 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm dark:border-indigo-500/20 dark:bg-slate-900/60 max-w-full overflow-hidden">
                      <p className="truncate font-mono text-xs font-medium text-slate-600 dark:text-slate-300 select-all flex-1 min-w-0">
                        {inviteUrl(invite.token)}
                      </p>
                    </div>
                    {!shareable && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        {lang === "tr"
                          ? "Dikkat: link localhost'a işaret ediyor, başka cihazda açılmaz. NEXT_PUBLIC_APP_URL tanımlayın veya panele ağ IP'si üzerinden girin."
                          : "Warning: link points to localhost and won't open on another device. Set NEXT_PUBLIC_APP_URL or use the LAN IP."}
                      </p>
                    )}
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Clock size={11} className="shrink-0" />
                      <span>
                        {lang === "tr" ? "Son geçerlilik: " : "Expires: "}
                        {new Date(invite.expires_at).toLocaleDateString(
                          lang === "tr" ? "tr-TR" : "en-US",
                          { day: "numeric", month: "long", year: "numeric" },
                        )}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopy(invite.id, invite.token)}
                      className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {copiedId === invite.id ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedId === invite.id
                        ? lang === "tr"
                          ? "Kopyalandı"
                          : "Copied"
                        : lang === "tr"
                          ? "Kopyala"
                          : "Copy"}
                    </button>

                    <a
                      href={buildWhatsAppInviteUrl(
                        inviteUrl(invite.token),
                        tenantName,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/25 transition-colors hover:bg-emerald-600"
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </a>

                    <button
                      onClick={() => setPendingRevoke(invite.id)}
                      disabled={busyId === invite.id}
                      title={lang === "tr" ? "İptal et" : "Revoke"}
                      className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-red-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-red-400 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
