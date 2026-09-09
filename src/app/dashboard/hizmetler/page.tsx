"use client";

import { useEffect, useState } from "react";
import { Plus, X, Clock, Scissors, Trash2, Edit2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/CustomSelect";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  is_active: boolean;
}

const CATEGORIES = ["Tümü", "Saç", "Sakal", "Cilt Bakımı", "Diğer"] as const;
type Category = typeof CATEGORIES[number];

function detectCategory(service: Service): "Saç" | "Sakal" | "Cilt Bakımı" | "Diğer" {
  const desc = service.description || "";
  const match = desc.match(/\[Kategori:\s*([^\]]+)\]/i);
  if (match && match[1]) {
    const cat = match[1].trim();
    if (["Saç", "Sakal", "Cilt Bakımı", "Diğer"].includes(cat)) {
      return cat as "Saç" | "Sakal" | "Cilt Bakımı" | "Diğer";
    }
  }

  const text = `${service.name} ${desc}`.toLowerCase();
  if (/sakal|bıyık|biyik|tıraş|tiras|beard|shave/.test(text)) {
    return "Sakal";
  }
  if (/cilt|maske|bakım|bakim|peeling|masaj|kaş|kas|ağda|agda|facial|skin/.test(text)) {
    return "Cilt Bakımı";
  }
  if (/saç|sac|kesim|boya|fön|fon|balyaj|röfle|rofle|keratin|perma|hair/.test(text)) {
    return "Saç";
  }
  return "Diğer";
}

function getCleanDescription(desc: string | null): string {
  if (!desc) return "";
  return desc.replace(/\[Kategori:\s*[^\]]+\]\s*/i, "").trim();
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
  const [selectedCategory, setSelectedCategory] = useState<Category>("Tümü");

  const [form, setForm] = useState({
    name: "",
    category: "Saç",
    description: "",
    duration: "",
    price: "",
  });

  const fetchServices = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile, error: profileErr } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (profileErr) {
        alert("Profil çekilirken veritabanı hatası: " + profileErr.message);
      }
      if (profile) {
        setTenantId(profile.tenant_id);
        const { data } = await supabase
          .from("services")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (data) setServices(data as Service[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      alert("Hata: İşletme kimliğiniz (Tenant ID) bulunamadı! Lütfen SQL kodunu başarıyla çalıştırdığınızdan emin olun.");
      return;
    }
    setSaving(true);

    const descClean = form.description.trim();
    const finalDescription = `[Kategori: ${form.category}]${descClean ? ` ${descClean}` : ""}`;

    if (editingService) {
      const { error } = await supabase.from("services").update({
        name: form.name,
        description: finalDescription,
        duration: parseInt(form.duration),
        price: parseFloat(form.price),
      }).eq("id", editingService.id);

      if (!error) {
        setModalOpen(false);
        setEditingService(null);
        setForm({ name: "", category: "Saç", description: "", duration: "", price: "" });
        fetchServices();
      } else {
        alert("Güncelleme hatası: " + error.message);
      }
    } else {
      const { error } = await supabase.from("services").insert({
        tenant_id: tenantId,
        name: form.name,
        description: finalDescription,
        duration: parseInt(form.duration),
        price: parseFloat(form.price),
      });

      if (!error) {
        setModalOpen(false);
        setForm({ name: "", category: "Saç", description: "", duration: "", price: "" });
        fetchServices();
      } else {
        alert("Ekleme hatası: " + error.message);
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu hizmeti silmek istediğinize emin misiniz? (Mevcut randevular bu hizmeti kullanamaz hale gelebilir)")) return;
    await supabase.from("services").delete().eq("id", id);
    fetchServices();
  };

  const filteredServices = services.filter((service) => {
    if (selectedCategory === "Tümü") return true;
    return detectCategory(service) === selectedCategory;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{t("services.title")}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {services.length} {lang === "tr" ? "hizmet tanımlı" : "services defined"}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingService(null);
            setForm({ name: "", category: "Saç", description: "", duration: "", price: "" });
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95"
        >
          <Plus size={20} strokeWidth={2.5} />
          {t("btn.add")}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar select-none">
        {CATEGORIES.map((cat) => {
          const count = cat === "Tümü" 
            ? services.length 
            : services.filter((s) => detectCategory(s) === cat).length;
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-all shrink-0 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-white/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-700/80 dark:hover:bg-slate-800"
              }`}
            >
              <span>{cat}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Compact Services List */}
      <div className="overflow-hidden rounded-3xl bg-white/80 backdrop-blur-2xl shadow-sm dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
              {t("header.loading")}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
                <Scissors className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedCategory === "Tümü"
                  ? t("services.empty")
                  : (lang === "tr" ? `Bu kategoride henüz hizmet bulunmuyor.` : `No services in this category yet.`)}
              </p>
              <button
                onClick={() => {
                  setEditingService(null);
                  setForm({
                    name: "",
                    category: selectedCategory === "Tümü" ? "Saç" : selectedCategory,
                    description: "",
                    duration: "",
                    price: "",
                  });
                  setModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
              >
                <Plus size={16} />
                {t("btn.add")}
              </button>
            </div>
          ) : (
            filteredServices.map((service) => {
              const cat = detectCategory(service);
              const cleanDesc = (service.description || "").replace(/\[Kategori:\s*[^\]]+\]/gi, "").trim();

              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between py-2.5 px-4 sm:py-3 sm:px-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 select-none">
                      <Scissors size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white truncate select-text">
                          {service.name}
                        </h3>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 select-none">
                          {cat}
                        </span>
                      </div>
                      {cleanDesc && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 select-text">
                          {cleanDesc}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 ml-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 select-none">
                        <Clock size={13} className="text-slate-400" />
                        <span>{service.duration} {lang === "tr" ? "dk" : "min"}</span>
                      </div>
                      
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs sm:text-sm font-extrabold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50 shadow-xs select-text">
                        ₺{service.price.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingService(service);
                          setForm({
                            name: service.name,
                            category: cat,
                            description: cleanDesc,
                            duration: service.duration.toString(),
                            price: service.price.toString(),
                          });
                          setModalOpen(true);
                        }}
                        className="rounded-full p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(service.id);
                        }}
                        className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
                  {lang === "tr" ? "Kategori" : "Category"}
                </label>
                <CustomSelect
                  value={form.category}
                  onChange={(val) => setForm({ ...form, category: val })}
                  options={["Saç", "Sakal", "Cilt Bakımı", "Diğer"]}
                  buttonClassName="w-full flex items-center justify-between rounded-2xl border-0 bg-white/60 px-4 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/60 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all text-sm cursor-pointer"
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
