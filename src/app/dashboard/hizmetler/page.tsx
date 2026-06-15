"use client";

import { useEffect, useState } from "react";
import { Plus, X, Clock, Banknote, Scissors, Trash2, Edit2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  is_active: boolean;
}



export default function HizmetlerPage() {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
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

    if (editingService) {
      const { error } = await supabase.from("services").update({
        name: form.name,
        description: form.description || null,
        duration: parseInt(form.duration),
        price: parseFloat(form.price),
      }).eq("id", editingService.id);

      if (!error) {
        setModalOpen(false);
        setEditingService(null);
        setForm({ name: "", description: "", duration: "", price: "" });
        fetchServices();
      } else {
        alert("Güncelleme hatası: " + error.message);
      }
    } else {
      const { error } = await supabase.from("services").insert({
        tenant_id: tenantId,
        name: form.name,
        description: form.description || null,
        duration: parseInt(form.duration),
        price: parseFloat(form.price),
      });

      if (!error) {
        setModalOpen(false);
        setForm({ name: "", description: "", duration: "", price: "" });
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Hizmetler</h1>
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
          Yeni Hizmet
        </button>
      </div>

      {/* Inset Grouped List */}
      <div className="overflow-hidden rounded-[32px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/50 dark:border-slate-700/50">
        <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
          {loading ? (
            <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
              Yükleniyor...
            </div>
          ) : services.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
                <Scissors className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">Henüz hizmet eklenmemiş</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Müşterilerinize sunacağınız ilk hizmeti ekleyin.</p>
            </div>
          ) : (
            services.map((service) => (
              <div
                key={service.id}
                className="group flex items-center justify-between p-4 sm:p-5 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 transition-transform group-hover:scale-105">
                    <Scissors size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{service.name}</h3>
                    {service.description && (
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400 line-clamp-1">{service.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Clock size={16} className="text-gray-400" />
                      {service.duration} dk
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Banknote size={16} className="text-gray-400" />
                      ₺{service.price.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingService(service);
                        setForm({
                          name: service.name,
                          description: service.description || "",
                          duration: service.duration.toString(),
                          price: service.price.toString(),
                        });
                        setModalOpen(true);
                      }}
                      className="rounded-full p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(service.id);
                      }}
                      className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-md bg-black/20 dark:bg-black/40 transition-opacity"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-3xl dark:border-slate-700/50 dark:bg-slate-900/80 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingService ? "Hizmet Düzenle" : "Yeni Hizmet"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Hizmet Adı
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                  placeholder="Örn: Saç Kesimi"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Açıklama
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                  placeholder="Hizmet hakkında kısa bilgi..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    Süre (dk)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.duration}
                    onChange={(e) =>
                      setForm({ ...form, duration: e.target.value })
                    }
                    className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                    placeholder="Örn: 30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    Fiyat (₺)
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
                    className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                    placeholder="Örn: 150"
                  />
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-full bg-indigo-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
