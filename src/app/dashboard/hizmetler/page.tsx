"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  X,
  Clock,
  Scissors,
  Trash2,
  Edit2,
  Search,
  Users,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/CustomSelect";
import { sortStaffOwnerFirst, type StaffMember } from "@/lib/staff";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  is_active: boolean;
  /** Hizmeti veren ekip üyesi (services.staff_id) */
  staff_id?: string | null;
}

const CATEGORY_MARKER = /\[Kategori:\s*[^\]]+\]\s*/gi;

/** Eski kayıtlarda açıklamaya gömülmüş [Kategori: X] etiketini temizler */
function cleanServiceDescription(desc: string | null): string {
  if (!desc) return "";
  return desc.replace(CATEGORY_MARKER, "").trim();
}

export default function HizmetlerPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Yetki: owner işletmedeki her elemanın hizmetlerini, staff sadece kendininkini yönetir
  const [role, setRole] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const isOwner = role === "owner";
  const ownerId = useMemo(
    () => staffList.find((m) => m.role === "owner")?.id ?? null,
    [staffList],
  );
  const selectedStaff = useMemo(
    () => staffList.find((m) => m.id === selectedStaffId) ?? null,
    [staffList, selectedStaffId],
  );
  const viewingOtherStaff =
    isOwner && !!selectedStaffId && !!ownerId && selectedStaffId !== ownerId;
  const staffOptions = useMemo(
    () =>
      staffList.map((m) => ({
        value: m.id,
        label: m.full_name?.trim() || (lang === "tr" ? "İsimsiz" : "Unnamed"),
        badge: m.role === "owner" ? "👑" : undefined,
        sublabel:
          m.role === "owner"
            ? lang === "tr"
              ? "İşletme Sahibi"
              : "Business Owner"
            : lang === "tr"
              ? "Eleman"
              : "Staff",
      })),
    [staffList, lang],
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase().trim();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [services, searchQuery]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    duration: "",
    price: "",
  });

  const fetchServices = async (tid: string, staffId: string) => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", staffId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      alert("Hizmetler çekilirken veritabanı hatası: " + error.message);
      setServices([]);
      return;
    }
    setServices((data as Service[]) ?? []);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("tenant_id, role")
        .eq("id", user.id)
        .single();

      if (profileErr) {
        alert("Profil çekilirken veritabanı hatası: " + profileErr.message);
      }
      if (!profile?.tenant_id) {
        setLoading(false);
        return;
      }

      setTenantId(profile.tenant_id);
      setRole(profile.role);

      // İşletmedeki ekip üyeleri (sahip + elemanlar)
      const { data: team } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("tenant_id", profile.tenant_id)
        .in("role", ["owner", "staff"])
        .order("created_at", { ascending: true });

      const teamList = sortStaffOwnerFirst((team as StaffMember[]) ?? []);
      setStaffList(teamList);

      // Varsayılan seçim: sahip kendi hizmetleriyle açılır, eleman kendisiyle
      const initialStaffId =
        profile.role === "owner"
          ? (teamList.find((m) => m.role === "owner")?.id ?? user.id)
          : user.id;

      setSelectedStaffId(initialStaffId);
      await fetchServices(profile.tenant_id, initialStaffId);
      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tek seferlik ilk yükleme
  }, []);

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    setSearchQuery("");
    if (tenantId) fetchServices(tenantId, staffId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      alert(
        "Hata: İşletme kimliğiniz (Tenant ID) bulunamadı! Lütfen SQL kodunu başarıyla çalıştırdığınızdan emin olun.",
      );
      return;
    }
    if (!selectedStaffId) {
      alert("Hata: Hizmetin atanacağı eleman bulunamadı.");
      return;
    }
    setSaving(true);

    const finalDescription = form.description.trim();

    if (editingService) {
      const { error } = await supabase
        .from("services")
        .update({
          name: form.name,
          description: finalDescription,
          duration: parseInt(form.duration),
          price: parseFloat(form.price),
        })
        .eq("id", editingService.id);

      if (!error) {
        setModalOpen(false);
        setEditingService(null);
        setForm({ name: "", description: "", duration: "", price: "" });
        fetchServices(tenantId, selectedStaffId);
      } else {
        alert("Güncelleme hatası: " + error.message);
      }
    } else {
      const { error } = await supabase.from("services").insert({
        tenant_id: tenantId,
        // Hizmet, seçili elemana atanır (staff için seçim kilitli)
        staff_id: selectedStaffId,
        name: form.name,
        description: finalDescription,
        duration: parseInt(form.duration),
        price: parseFloat(form.price),
      });

      if (!error) {
        setModalOpen(false);
        setForm({ name: "", description: "", duration: "", price: "" });
        fetchServices(tenantId, selectedStaffId);
      } else {
        alert("Ekleme hatası: " + error.message);
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Bu hizmeti silmek istediğinize emin misiniz? (Mevcut randevular bu hizmeti kullanamaz hale gelebilir)",
      )
    )
      return;
    await supabase.from("services").delete().eq("id", id);
    if (tenantId && selectedStaffId) fetchServices(tenantId, selectedStaffId);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {t("services.title")}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {services.length}{" "}
            {lang === "tr" ? "hizmet tanımlı" : "services defined"}
            {viewingOtherStaff && selectedStaff
              ? ` • ${selectedStaff.full_name ?? ""}`
              : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingService(null);
            setForm({ name: "", description: "", duration: "", price: "" });
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95"
        >
          <Plus size={20} strokeWidth={2.5} />
          {t("btn.add")}
        </button>
      </div>

      {/* Ekip filtresi: işletme sahibi başka elemanların hizmetlerini de yönetebilir */}
      {isOwner && staffList.length > 1 && (
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Users size={18} className="text-indigo-500" />
            {lang === "tr" ? "Hangi elemanın hizmetleri?" : "Whose services?"}
          </div>
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <CustomSelect
              value={selectedStaffId ?? ""}
              onChange={handleStaffChange}
              options={staffOptions}
              searchable={staffOptions.length > 6}
            />
          </div>
        </div>
      )}

      {!isOwner && role === "staff" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-3.5 text-xs font-medium text-indigo-800 dark:border-indigo-500/25 dark:bg-indigo-950/30 dark:text-indigo-200">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          {lang === "tr"
            ? "Sadece kendi hizmetlerinizi görüntüleyip düzenleyebilirsiniz."
            : "You can only view and manage your own services."}
        </div>
      )}

      {/* Arama Çubuğu (Hizmet varsa) */}
      {services.length > 0 && (
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === "tr"
                ? "Hizmet adı veya açıklamayla ara..."
                : "Search by service name or description..."
            }
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Services Grid / Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-44 rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 animate-pulse p-5"
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-100 dark:border-indigo-900/50">
            <Scissors className="h-8 w-8" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {t("services.empty")}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {viewingOtherStaff
              ? lang === "tr"
                ? `${selectedStaff?.full_name ?? "Bu eleman"} için henüz hizmet eklenmemiş.`
                : `No services added for ${selectedStaff?.full_name ?? "this staff member"} yet.`
              : lang === "tr"
                ? "Müşterilerinizin randevu alabilmesi için ilk hizmetinizi ekleyin."
                : "Add your first service so customers can start booking."}
          </p>
          <button
            onClick={() => {
              setEditingService(null);
              setForm({
                name: "",
                description: "",
                duration: "",
                price: "",
              });
              setModalOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={18} strokeWidth={2.5} />
            {t("btn.add")}
          </button>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-slate-500">
          {lang === "tr"
            ? "Aramanızla eşleşen hizmet bulunamadı."
            : "No services found matching your search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredServices.map((service) => {
            const cleanDesc = cleanServiceDescription(service.description);

            return (
              <div
                key={service.id}
                className="group relative flex flex-col justify-between rounded-3xl bg-white/85 dark:bg-slate-900/75 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-indigo-400/40 dark:hover:border-indigo-500/30 transition-all duration-200"
              >
                {/* Üst Kısım: İkon + İsim + Aksiyon Butonları */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/15 group-hover:scale-105 transition-transform mt-0.5">
                        <Scissors size={20} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug break-words">
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {lang === "tr" ? "Aktif Hizmet" : "Active"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Düzenle / Sil Butonları */}
                    <div className="flex items-center gap-1 shrink-0 bg-slate-100/70 dark:bg-slate-800/70 rounded-2xl p-1 border border-slate-200/50 dark:border-slate-700/50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingService(service);
                          setForm({
                            name: service.name,
                            description: cleanDesc,
                            duration: service.duration.toString(),
                            price: service.price.toString(),
                          });
                          setModalOpen(true);
                        }}
                        title={lang === "tr" ? "Düzenle" : "Edit"}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-400 transition-all shadow-xs cursor-pointer"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(service.id);
                        }}
                        title={lang === "tr" ? "Sil" : "Delete"}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-red-400 transition-all shadow-xs cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Açıklama */}
                  {cleanDesc && (
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                      {cleanDesc}
                    </p>
                  )}
                </div>

                {/* Alt Kısım: Süre + Fiyat */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Clock size={14} className="text-indigo-500" />
                    <span>
                      {service.duration} {lang === "tr" ? "dakika" : "minutes"}
                    </span>
                  </div>

                  <div className="inline-flex items-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50 shadow-xs">
                    {formatPrice(service.price)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-md bg-black/20 dark:bg-black/40 animate-backdrop-in"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-3xl dark:border-slate-700/50 dark:bg-slate-900/80 animate-modal-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingService ? t("services.edit") : t("services.add_new")}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("services.name")}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all text-sm"
                  placeholder="Örn: Saç Kesimi & Yıkama"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {lang === "tr" ? "Açıklama" : "Description"}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all text-sm"
                  placeholder="Hizmet hakkında kısa bilgi..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {lang === "tr" ? "Süre (dk)" : "Duration (min)"}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.duration}
                    onChange={(e) =>
                      setForm({ ...form, duration: e.target.value })
                    }
                    className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all text-sm"
                    placeholder="Örn: 30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {lang === "tr" ? "Fiyat (₺)" : "Price (₺)"}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all text-sm"
                    placeholder="Örn: 150"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300/50 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t("btn.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95"
                >
                  {saving ? t("header.loading") : t("btn.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
