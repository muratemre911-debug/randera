"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Loader2,
  LogOut,
  Minus,
  Plus,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Tags,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Sector } from "@/types";
import type { AdminAccount } from "@/app/api/admin/accounts/route";
import CustomSelect from "@/components/CustomSelect";
import { SUPER_ADMIN_EMAILS } from "@/lib/admin";
import {
  MONTHLY_DAYS,
  TRIAL_DAYS,
  formatRemaining,
  type MembershipInfo,
} from "@/lib/membership";

type Tab =
  | "membership"
  | "tenants"
  | "customers"
  | "create"
  | "sectors"
  | "notifications";
type ListFilter = "all" | "business" | "customer" | "soon" | "suspended";

interface NotificationHistoryItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
  tenants?: { name: string };
}

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "membership", label: "Yetki & Üyelik", icon: ShieldCheck },
  { id: "tenants", label: "İşletmeler", icon: Store },
  { id: "customers", label: "Müşteriler", icon: Users },
  { id: "create", label: "Hesap Aç", icon: Plus },
  { id: "sectors", label: "Sektörler", icon: Tags },
  { id: "notifications", label: "Bildirimler", icon: Bell },
];

const CARD =
  "rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-900/60";

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:bg-slate-800";

const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50";

function statusStyle(kind: MembershipInfo["kind"]) {
  switch (kind) {
    case "unlimited":
      return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25";
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25";
    case "trial":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  }
}

function MembershipBadge({
  info,
  className = "",
}: {
  info: MembershipInfo;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${statusStyle(
        info.kind,
      )} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {formatRemaining(info)}
    </span>
  );
}

/**
 * Hesap rozeti: işletmesi olmayan (henüz yetki verilmemiş) hesaplarda üyelik
 * durumu yerine nötr "Müşteri" rozeti gösterilir.
 */
function AccountStatusBadge({
  hasBusiness,
  info,
  className = "",
}: {
  hasBusiness: boolean;
  info: MembershipInfo;
  className?: string;
}) {
  if (!hasBusiness) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${className}`}
      >
        <User size={11} />
        Müşteri
      </span>
    );
  }

  return <MembershipBadge info={info} className={className} />;
}

/** Liste sıralaması: sınırsız üyelikli (süper admin) işletmeler en sonda */
function membershipRank(info: MembershipInfo): number {
  return info.kind === "unlimited" ? Number.MAX_SAFE_INTEGER : info.daysLeft;
}

function matchesQuery(account: AdminAccount, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    account.fullName,
    account.email,
    account.tenantName ?? "",
    account.sector ?? "",
    account.tenantId ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export default function SuperAdminPage() {
  const supabase = createClient();
  const router = useRouter();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("membership");

  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Liste + arama
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [selected, setSelected] = useState<AdminAccount | null>(null);

  // Üyelik işlemleri
  const [customDays, setCustomDays] = useState("60");
  const [reduceDays, setReduceDays] = useState("7");
  const [actionLoading, setActionLoading] = useState(false);

  // Yetki ver (müşteri → işletme)
  const [grantForm, setGrantForm] = useState({
    tenantName: "",
    sector: "",
    days: String(TRIAL_DAYS),
  });
  const [grantLoading, setGrantLoading] = useState(false);

  // Hesap açma
  const [form, setForm] = useState({
    tenantName: "",
    fullName: "",
    sector: "",
    email: "",
    password: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // İşletme düzenleme
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    tenantName: "",
    email: "",
    password: "",
  });
  const [saveLoading, setSaveLoading] = useState(false);

  // Sektör
  const [newSector, setNewSector] = useState("");
  const [sectorLoading, setSectorLoading] = useState(false);

  // Bildirimler
  const [notifForm, setNotifForm] = useState({
    title: "",
    message: "",
    targetType: "all",
    targetId: "",
    sectorValue: "",
    targetValue: "",
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState("");
  const [notifError, setNotifError] = useState("");
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryItem[]>(
    [],
  );
  const [notifHistoryLoading, setNotifHistoryLoading] = useState(false);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAccounts = useCallback(async (): Promise<AdminAccount[]> => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/admin/accounts");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAccounts(data as AdminAccount[]);
        return data as AdminAccount[];
      }
      showToast("error", data.error || "Hesaplar alınamadı");
    } catch {
      showToast("error", "Hesaplar alınamadı");
    } finally {
      setAccountsLoading(false);
    }
    return [];
  }, []);

  const fetchSectors = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sectors");
      const data = await res.json();
      if (Array.isArray(data)) setSectors(data as Sector[]);
    } catch {
      /* sektör listesi kritik değil */
    }
  }, []);

  const fetchNotificationHistory = useCallback(async () => {
    setNotifHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (Array.isArray(data))
        setNotifHistory(data as NotificationHistoryItem[]);
    } catch {
      /* geçmiş yüklenemezse sessiz geç */
    } finally {
      setNotifHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (
        !user?.email ||
        !SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())
      ) {
        setAuthorized(false);
        return;
      }
      setAdminEmail(user.email);
      setAuthorized(true);
      fetchAccounts();
      fetchSectors();
    };
    checkAuth();
  }, [fetchAccounts, fetchSectors, supabase]);

  useEffect(() => {
    if (activeTab !== "notifications") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sekme açıldığında bildirim geçmişini çek
    fetchNotificationHistory();
  }, [activeTab, fetchNotificationHistory]);

  const businessAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.tenantId)
        // Süper admin işletmeleri (sınırsız) listenin sonunda görünsün
        .sort(
          (a, b) =>
            membershipRank(a.membership) - membershipRank(b.membership) ||
            a.membership.daysLeft - b.membership.daysLeft,
        ),
    [accounts],
  );

  const visibleAccounts = useMemo(() => {
    const base =
      activeTab === "customers"
        ? accounts.filter((a) => !a.tenantId)
        : activeTab === "tenants"
          ? businessAccounts
          : accounts;

    return base.filter((a) => {
      if (!matchesQuery(a, search)) return false;
      if (activeTab !== "membership") return true;
      switch (listFilter) {
        case "business":
          return Boolean(a.tenantId);
        case "customer":
          return !a.tenantId;
        case "soon":
          // Yalnızca işletmesi olan hesaplar (müşteri hesaplarında üyelik yok)
          return (
            Boolean(a.tenantId) &&
            (a.membership.kind === "expired" ||
              (a.membership.daysLeft > 0 && a.membership.daysLeft <= 7))
          );
        case "suspended":
          return a.membership.kind === "suspended";
        default:
          return true;
      }
    });
  }, [accounts, activeTab, businessAccounts, listFilter, search]);

  const stats = useMemo(
    () => ({
      total: businessAccounts.length,
      active: businessAccounts.filter((a) => a.membership.kind === "active")
        .length,
      trial: businessAccounts.filter((a) => a.membership.kind === "trial")
        .length,
      closed: businessAccounts.filter((a) => a.membership.kind === "suspended")
        .length,
      expired: businessAccounts.filter((a) => a.membership.kind === "expired")
        .length,
    }),
    [businessAccounts],
  );

  /** Süper admin üyelik işlemi */
  const runMembership = async (
    payload: Record<string, unknown>,
    successMessage: string,
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      showToast("success", successMessage);
      const list = await fetchAccounts();
      if (selected?.userId) {
        // seçili kartı güncel haliyle koru
        const updated = list.find((a) => a.userId === selected.userId);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "İşlem başarısız",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantBusiness = async () => {
    if (!selected) return;
    const days = Number(grantForm.days);
    if (
      !grantForm.tenantName.trim() ||
      !grantForm.sector ||
      !Number.isFinite(days) ||
      days <= 0
    ) {
      showToast("error", "İşletme adı, sektör ve gün sayısı gerekli");
      return;
    }
    setGrantLoading(true);
    await runMembership(
      {
        action:
          days === TRIAL_DAYS
            ? "load-trial"
            : days === MONTHLY_DAYS
              ? "load-monthly"
              : "load-custom",
        userId: selected.userId,
        tenantName: grantForm.tenantName.trim(),
        sector: grantForm.sector,
        days: days === TRIAL_DAYS || days === MONTHLY_DAYS ? undefined : days,
      },
      "İşletme yetkisi verildi",
    );
    setGrantForm({ tenantName: "", sector: "", days: String(TRIAL_DAYS) });
    setGrantLoading(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/create-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("success", "İşletme açıldı ve 14 günlük deneme yüklendi");
      setForm({
        tenantName: "",
        fullName: "",
        sector: sectors[0]?.value || "",
        email: "",
        password: "",
      });
      fetchAccounts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "İşletme açılamadı");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveEdit = async (account: AdminAccount) => {
    setSaveLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: account.tenantId,
          userId: account.userId,
          tenantName: editForm.tenantName,
          email: editForm.email || undefined,
          password: editForm.password || undefined,
        }),
      });
      if (res.ok) {
        setEditingTenant(null);
        setEditForm({ tenantName: "", email: "", password: "" });
        showToast("success", "İşletme güncellendi");
        fetchAccounts();
      } else {
        showToast("error", (await res.json()).error || "Güncellenemedi");
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteTenant = async (account: AdminAccount) => {
    if (
      !confirm(
        `DİKKAT: "${account.tenantName}" işletmesi ve sahibi silinecek. Devam?`,
      )
    )
      return;
    const res = await fetch(
      `/api/admin/tenants?tenantId=${account.tenantId}&userId=${account.userId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      showToast("success", "İşletme silindi");
      setSelected(null);
      fetchAccounts();
    } else {
      showToast("error", "Silinemedi");
    }
  };

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSector.trim()) return;
    setSectorLoading(true);
    try {
      const value = newSector.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const res = await fetch("/api/admin/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSector, value }),
      });
      if (res.ok) {
        setNewSector("");
        fetchSectors();
      } else {
        showToast("error", (await res.json()).error || "Sektör eklenemedi");
      }
    } finally {
      setSectorLoading(false);
    }
  };

  const handleDeleteSector = async (id: string) => {
    if (!confirm("Sektörü silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/admin/sectors?id=${id}`, { method: "DELETE" });
    fetchSectors();
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Bu bildirim herkesten silinecek. Devam?")) return;
    const res = await fetch(`/api/admin/notifications?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) setNotifHistory((prev) => prev.filter((n) => n.id !== id));
    else showToast("error", "Bildirim silinemedi");
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifLoading(true);
    setNotifError("");
    setNotifSuccess("");
    try {
      const res = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotifSuccess(`Bildirim ${data.sentCount} işletmeye gönderildi.`);
      setNotifForm({ ...notifForm, title: "", message: "" });
      fetchNotificationHistory();
    } catch (err) {
      setNotifError(
        err instanceof Error ? err.message : "Bildirim gönderilemedi",
      );
    } finally {
      setNotifLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (authorized === null) {
    return (
      <div className="page-fill flex items-center justify-center bg-slate-50 dark:bg-[#0B0D14]">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="page-fill flex items-center justify-center bg-slate-50 p-4 dark:bg-[#0B0D14]">
        <div className={`${CARD} w-full max-w-md p-10 text-center`}>
          <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Yetkisiz Erişim
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Bu panel yalnızca sistem yöneticisine açıktır.
          </p>
          <Link href="/login" className={`${BTN_PRIMARY} mt-6`}>
            Sisteme Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0B0D14]">
      {/* Üst bar (sabit kalır, içerik alanı kendi içinde kayar) */}
      <header className="z-30 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur-2xl dark:border-slate-800/70 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Süper Admin
                </h1>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {adminEmail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut size={15} />
              Çıkış
            </button>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1 scrollbar-none dark:border-slate-800 dark:bg-slate-800/50">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-16 sm:px-6">
          {/* Özet kartları */}
          {activeTab !== "notifications" && activeTab !== "sectors" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  label: "İşletme",
                  value: stats.total,
                  icon: Store,
                  tone: "text-indigo-600 dark:text-indigo-400",
                },
                {
                  label: "Aktif üyelik",
                  value: stats.active,
                  icon: CheckCircle2,
                  tone: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: "Deneme",
                  value: stats.trial,
                  icon: Sparkles,
                  tone: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "Süresi dolmuş",
                  value: stats.expired,
                  icon: CalendarClock,
                  tone: "text-slate-500 dark:text-slate-400",
                },
                {
                  label: "Kapalı",
                  value: stats.closed,
                  icon: Ban,
                  tone: "text-red-600 dark:text-red-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`${CARD} flex items-center gap-3 p-4`}
                >
                  <s.icon size={20} className={s.tone} />
                  <div>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {s.value}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {s.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* YETKİ & ÜYELİK / İŞLETMELER / MÜŞTERİLER */}
          {(activeTab === "membership" ||
            activeTab === "tenants" ||
            activeTab === "customers") && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
              {/* Sol: liste */}
              <section className={`${CARD} flex flex-col p-5`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeTab === "tenants"
                        ? "İşletmeler"
                        : activeTab === "customers"
                          ? "Müşteriler"
                          : "Hesaplar"}
                    </h2>
                    <button
                      type="button"
                      onClick={fetchAccounts}
                      className="inline-flex min-h-6 items-center px-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Yenile
                    </button>
                  </div>

                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="İşletme adı, e-posta veya sektör ara..."
                      className={`${INPUT} pl-10`}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {activeTab === "membership" && (
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "all", label: "Tümü" },
                          { id: "business", label: "İşletmeler" },
                          { id: "customer", label: "Müşteri hesapları" },
                          { id: "soon", label: "Bitişi yakın (≤7 gün)" },
                          { id: "suspended", label: "Kapalı" },
                        ] as { id: ListFilter; label: string }[]
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setListFilter(f.id)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                            listFilter === f.id
                              ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                              : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex max-h-[540px] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  {accountsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2
                        className="animate-spin text-indigo-500"
                        size={28}
                      />
                    </div>
                  ) : visibleAccounts.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">
                      Sonuç bulunamadı.
                    </p>
                  ) : (
                    visibleAccounts.map((account) => {
                      const isSelected = selected?.userId === account.userId;
                      return (
                        <button
                          key={account.userId}
                          type="button"
                          onClick={() => {
                            setSelected(account);
                            setEditingTenant(null);
                          }}
                          className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-500/10"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                {account.tenantName ?? account.fullName}
                              </p>
                              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {account.tenantName
                                  ? `${account.fullName} • `
                                  : ""}
                                {account.email}
                              </p>
                            </div>
                            <AccountStatusBadge
                              hasBusiness={Boolean(account.tenantId)}
                              info={account.membership}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            {account.tenantId && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold dark:bg-slate-800">
                                <Building2 size={11} />
                                {account.sector || "sektör yok"}
                              </span>
                            )}
                            <span>{account.appointmentCount} randevu</span>
                            {account.tenantId &&
                              account.membership.kind === "suspended" && (
                                <span className="font-bold text-red-500">
                                  üyelik kapalı
                                </span>
                              )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Sağ: detay / işlem */}
              <section className={`${CARD} p-5`}>
                {!selected ? (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
                    <ShieldCheck
                      size={32}
                      className="text-slate-300 dark:text-slate-700"
                    />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Bir hesap seçin
                    </p>
                    <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                      Soldaki listeden işletme veya müşteri hesabı seçip üyelik
                      yükleyebilir, süre düşürebilir ya da üyeliği
                      kapatabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-slate-900 dark:text-white">
                          {selected.tenantName ?? selected.fullName}
                        </h3>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {selected.email} • {selected.role}
                        </p>
                        {selected.membership.endsAt && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Bitiş:{" "}
                            {new Date(
                              selected.membership.endsAt,
                            ).toLocaleDateString("tr-TR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <AccountStatusBadge
                        hasBusiness={Boolean(selected.tenantId)}
                        info={selected.membership}
                        className="shrink-0"
                      />
                    </div>

                    {/* Müşteri hesabı → işletme yetkisi */}
                    {!selected.tenantId ? (
                      <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-500/25 dark:bg-violet-500/10">
                        <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                          Bu hesabın işletmesi yok. Bilgileri girip yetki verin:
                        </p>
                        <input
                          type="text"
                          value={grantForm.tenantName}
                          onChange={(e) =>
                            setGrantForm({
                              ...grantForm,
                              tenantName: e.target.value,
                            })
                          }
                          placeholder="İşletme adı"
                          className={INPUT}
                        />
                        <CustomSelect
                          value={grantForm.sector}
                          onChange={(val) =>
                            setGrantForm({ ...grantForm, sector: String(val) })
                          }
                          options={sectors.map((s) => ({
                            value: s.value,
                            label: s.name,
                          }))}
                          placeholder="Sektör seçin"
                          searchable
                          searchPlaceholder="Sektör ara..."
                          buttonClassName="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800/60 dark:text-white cursor-pointer"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {[TRIAL_DAYS, MONTHLY_DAYS, 90].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                setGrantForm({ ...grantForm, days: String(d) })
                              }
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                                grantForm.days === String(d)
                                  ? "border-violet-600 bg-violet-600 text-white"
                                  : "border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-500/30 dark:text-violet-300"
                              }`}
                            >
                              {d === TRIAL_DAYS
                                ? `${d} gün deneme`
                                : d === MONTHLY_DAYS
                                  ? "1 aylık üyelik"
                                  : `${d} gün üyelik`}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            value={grantForm.days}
                            onChange={(e) =>
                              setGrantForm({
                                ...grantForm,
                                days: e.target.value,
                              })
                            }
                            className="w-24 rounded-full border border-violet-200 px-3 py-1.5 text-[11px] font-bold text-violet-700 outline-none dark:border-violet-500/30 dark:bg-slate-800 dark:text-violet-300"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleGrantBusiness}
                          disabled={grantLoading || actionLoading}
                          className={`${BTN_PRIMARY} w-full bg-violet-600 hover:bg-violet-500`}
                        >
                          {grantLoading || actionLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Sparkles size={16} />
                          )}
                          İşletme Yetkisi Ver
                        </button>
                      </div>
                    ) : selected.membership.kind === "unlimited" ? (
                      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/25 dark:bg-violet-500/10">
                        <p className="flex items-center gap-2 text-sm font-bold text-violet-700 dark:text-violet-300">
                          <ShieldCheck size={16} />
                          Sınırsız üyelik (Süper Admin hesabı)
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-violet-700/80 dark:text-violet-300/80">
                          Bu hesap sistem yöneticisine ait: üyelik süresi
                          işlemez, süre yüklenemez/düşürülemez, üyelik
                          kapatılamaz ve işletme silinemez.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Süre yükleme */}
                        <div className="space-y-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Üyelik Yükle
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                runMembership(
                                  {
                                    action: "load-trial",
                                    tenantId: selected.tenantId,
                                  },
                                  `${TRIAL_DAYS} günlük deneme yüklendi`,
                                )
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition-all hover:bg-amber-100 active:scale-95 disabled:opacity-50 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400"
                            >
                              <Sparkles size={16} />
                              {TRIAL_DAYS} gün deneme
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                runMembership(
                                  {
                                    action: "load-monthly",
                                    tenantId: selected.tenantId,
                                  },
                                  "1 aylık üyelik yüklendi",
                                )
                              }
                              className={BTN_PRIMARY}
                            >
                              <CheckCircle2 size={16} />1 aylık üyelik
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              value={customDays}
                              onChange={(e) => setCustomDays(e.target.value)}
                              className={`${INPUT} w-28 text-center`}
                            />
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                runMembership(
                                  {
                                    action: "load-custom",
                                    tenantId: selected.tenantId,
                                    days: Number(customDays),
                                  },
                                  `${customDays} günlük üyelik yüklendi`,
                                )
                              }
                              className={`${BTN_PRIMARY} flex-1`}
                            >
                              <Plus size={16} />
                              {customDays || "X"} gün üyelik yükle
                            </button>
                          </div>
                        </div>

                        {/* Süre düşür / kapat */}
                        <div className="space-y-2.5 border-t border-slate-200/70 pt-4 dark:border-slate-800">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Süre Düşür & Kapat
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              value={reduceDays}
                              onChange={(e) => setReduceDays(e.target.value)}
                              className={`${INPUT} w-28 text-center`}
                            />
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                runMembership(
                                  {
                                    action: "adjust",
                                    tenantId: selected.tenantId,
                                    days: -Math.abs(Number(reduceDays)),
                                  },
                                  `${reduceDays} gün düşürüldü`,
                                )
                              }
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Minus size={16} />
                              {reduceDays || "X"} gün azalt
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selected.membership.kind === "suspended" ? (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  runMembership(
                                    {
                                      action: "activate",
                                      tenantId: selected.tenantId,
                                    },
                                    "Üyelik yeniden açıldı",
                                  )
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 disabled:opacity-50 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400"
                              >
                                <CheckCircle2 size={16} />
                                Üyeliği Aç
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => {
                                  if (
                                    !confirm(
                                      "Üyelik kapatılacak: işletme paneli bloke olur ve keşfet listesinden çıkar. Devam?",
                                    )
                                  )
                                    return;
                                  runMembership(
                                    {
                                      action: "suspend",
                                      tenantId: selected.tenantId,
                                    },
                                    "Üyelik kapatıldı",
                                  );
                                }}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400"
                              >
                                <Ban size={16} />
                                Üyeliği Kapat
                              </button>
                            )}
                          </div>
                          {actionLoading && (
                            <p className="flex items-center gap-2 text-[11px] text-slate-400">
                              <Loader2 size={12} className="animate-spin" />{" "}
                              İşlem uygulanıyor...
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* İşletme düzenleme / silme */}
                    {selected.tenantId && (
                      <div className="space-y-3 border-t border-slate-200/70 pt-4 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            İşletme Bilgileri
                          </p>
                          {editingTenant === selected.tenantId ? (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(selected)}
                                disabled={saveLoading}
                                className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                title="Kaydet"
                              >
                                {saveLoading ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Save size={15} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTenant(null)}
                                className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                title="Vazgeç"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTenant(selected.tenantId);
                                setEditForm({
                                  tenantName: selected.tenantName ?? "",
                                  email: selected.email,
                                  password: "",
                                });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                            >
                              <Edit3 size={13} />
                              Düzenle
                            </button>
                          )}
                        </div>

                        {editingTenant === selected.tenantId ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editForm.tenantName}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  tenantName: e.target.value,
                                })
                              }
                              placeholder="İşletme adı"
                              className={INPUT}
                            />
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  email: e.target.value,
                                })
                              }
                              placeholder="E-posta (değiştirmek istemiyorsan boş bırak)"
                              className={INPUT}
                            />
                            <input
                              type="password"
                              value={editForm.password}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  password: e.target.value,
                                })
                              }
                              placeholder="Yeni şifre (opsiyonel)"
                              className={INPUT}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold dark:bg-slate-800">
                              ID: {selected.tenantId.slice(0, 8)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold dark:bg-slate-800">
                              {selected.sector || "sektör yok"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold dark:bg-slate-800">
                              {selected.tenantIsActive
                                ? "keşfette görünür"
                                : "keşfette gizli"}
                            </span>
                          </div>
                        )}

                        {selected.membership.kind === "unlimited" ? (
                          <p className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-center text-xs font-bold text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300">
                            Süper admin işletmesi silinemez.
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteTenant(selected)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/25 dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                            İşletmeyi ve sahibini sil
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* HESAP AÇ */}
          {activeTab === "create" && (
            <section className={`${CARD} mx-auto w-full max-w-2xl p-6`}>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Yeni işletme hesabı aç
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Hesap açıldığında {TRIAL_DAYS} günlük deneme otomatik yüklenir;
                süreyi Yetki & Üyelik sekmesinden uzatabilirsiniz.
              </p>

              {createError && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
                <input
                  required
                  type="text"
                  value={form.tenantName}
                  onChange={(e) =>
                    setForm({ ...form, tenantName: e.target.value })
                  }
                  placeholder="İşletme adı"
                  className={INPUT}
                />
                <input
                  required
                  type="text"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  placeholder="Yetkili ad soyad"
                  className={INPUT}
                />
                <CustomSelect
                  value={form.sector}
                  onChange={(val) => setForm({ ...form, sector: String(val) })}
                  options={sectors.map((s) => ({
                    value: s.value,
                    label: s.name,
                  }))}
                  placeholder="Sektör seçin"
                  searchable
                  searchPlaceholder="Sektör ara..."
                  buttonClassName="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800/60 dark:text-white cursor-pointer"
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="E-posta"
                    className={INPUT}
                  />
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Şifre (en az 6 karakter)"
                    className={INPUT}
                  />
                </div>
                <button
                  type="submit"
                  disabled={createLoading}
                  className={`${BTN_PRIMARY} w-full`}
                >
                  {createLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Hesabı Oluştur
                </button>
              </form>
            </section>
          )}

          {/* SEKTÖRLER */}
          {activeTab === "sectors" && (
            <section className={`${CARD} mx-auto w-full max-w-xl p-6`}>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Tags size={18} className="text-indigo-500" />
                Sektör Yönetimi
              </h2>
              <form onSubmit={handleAddSector} className="mt-5 flex gap-2">
                <input
                  type="text"
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value)}
                  placeholder="Yeni sektör adı"
                  className={INPUT}
                />
                <button
                  type="submit"
                  disabled={sectorLoading}
                  className={BTN_PRIMARY}
                >
                  {sectorLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Ekle
                </button>
              </form>
              <div className="mt-5 flex flex-col gap-2">
                {sectors.map((sector) => (
                  <div
                    key={sector.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {sector.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSector(sector.id)}
                      className="rounded-xl p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* BİLDİRİMLER */}
          {activeTab === "notifications" && (
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className={`${CARD} p-6`}>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <Send size={18} className="text-indigo-500" />
                  Bildirim Gönder
                </h2>

                {notifError && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400">
                    {notifError}
                  </div>
                )}
                {notifSuccess && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {notifSuccess}
                  </div>
                )}

                <form
                  onSubmit={handleSendNotification}
                  className="mt-5 space-y-4"
                >
                  <CustomSelect
                    value={notifForm.targetType}
                    onChange={(val) =>
                      setNotifForm({ ...notifForm, targetType: String(val) })
                    }
                    options={[
                      { value: "all", label: "Tüm işletmeler" },
                      { value: "sector", label: "Belirli bir sektör" },
                      { value: "single", label: "Tek bir işletme" },
                    ]}
                    buttonClassName="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800/60 dark:text-white cursor-pointer"
                  />

                  {notifForm.targetType === "sector" && (
                    <CustomSelect
                      value={notifForm.targetValue}
                      onChange={(val) =>
                        setNotifForm({ ...notifForm, targetValue: String(val) })
                      }
                      options={sectors.map((s) => ({
                        value: s.value,
                        label: s.name,
                      }))}
                      placeholder="Sektör seçin"
                      searchable
                      buttonClassName="w-full flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm font-medium dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-white cursor-pointer"
                    />
                  )}

                  {notifForm.targetType === "single" && (
                    <CustomSelect
                      value={notifForm.targetValue}
                      onChange={(val) =>
                        setNotifForm({ ...notifForm, targetValue: String(val) })
                      }
                      options={businessAccounts.map((a) => ({
                        value: a.tenantId as string,
                        label: a.tenantName ?? a.fullName,
                      }))}
                      placeholder="İşletme seçin"
                      searchable
                      buttonClassName="w-full flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm font-medium dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-white cursor-pointer"
                    />
                  )}

                  <input
                    required
                    type="text"
                    value={notifForm.title}
                    onChange={(e) =>
                      setNotifForm({ ...notifForm, title: e.target.value })
                    }
                    placeholder="Bildirim başlığı"
                    className={INPUT}
                  />
                  <textarea
                    required
                    rows={3}
                    value={notifForm.message}
                    onChange={(e) =>
                      setNotifForm({ ...notifForm, message: e.target.value })
                    }
                    placeholder="Bildirim mesajı..."
                    className={INPUT}
                  />
                  <button
                    type="submit"
                    disabled={notifLoading}
                    className={`${BTN_PRIMARY} w-full`}
                  >
                    {notifLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Bildirimi Gönder
                  </button>
                </form>
              </div>

              <div className={`${CARD} p-6`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Gönderilenler
                  </h2>
                  <button
                    type="button"
                    onClick={fetchNotificationHistory}
                    className="inline-flex min-h-6 items-center px-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Yenile
                  </button>
                </div>

                <div className="mt-4 flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  {notifHistoryLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2
                        className="animate-spin text-indigo-500"
                        size={26}
                      />
                    </div>
                  ) : notifHistory.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">
                      Geçmiş bildirim yok.
                    </p>
                  ) : (
                    notifHistory.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {n.message}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                              {n.tenants?.name || "Bilinmiyor"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleString("tr-TR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNotification(n.id)}
                          className="shrink-0 rounded-xl p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          title="Bildirimi sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
          <div
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-2xl ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-red-200 bg-red-50/95 text-red-700 dark:border-red-500/25 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
