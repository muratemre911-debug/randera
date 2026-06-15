"use client";

import { useEffect, useState } from "react";
import { Search, CalendarDays, Phone, Mail, ChevronRight, User, Plus, X, Trash2, Edit2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";



interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  appointment_count?: number;
}

export default function MusterilerPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "" });

  const fetchCustomers = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile) {
      setLoading(false);
      return;
    }
    setTenantId(profile.tenant_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "customer")
      .order("full_name");

    if (profiles) {
      const customerIds = profiles.map((p) => p.id);
      const { data: counts } = await supabase
        .from("appointments")
        .select("customer_id")
        .in("customer_id", customerIds)
        .neq("status", "cancelled");

      const countMap = new Map<string, number>();
      if (counts) {
        counts.forEach((a) => {
          countMap.set(a.customer_id, (countMap.get(a.customer_id) || 0) + 1);
        });
      }

      setCustomers(
        profiles.map((p) => ({
          ...p,
          appointment_count: countMap.get(p.id) || 0,
        })),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      alert("Hata: İşletme kimliğiniz (Tenant ID) bulunamadı! Lütfen SQL kodunu başarıyla çalıştırdığınızdan emin olun.");
      return;
    }
    setSaving(true);

    if (editingCustomer) {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone || null,
        })
        .eq("id", editingCustomer.id);
        
      if (!error) {
        setModalOpen(false);
        fetchCustomers();
      }
    } else {
      const { error } = await supabase.from("profiles").insert({
        tenant_id: tenantId,
        full_name: form.full_name,
        phone: form.phone || null,
        role: "customer",
      });

      if (!error) {
        setModalOpen(false);
        fetchCustomers();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz? Randevuları da etkilenebilir.")) return;
    await supabase.from("profiles").delete().eq("id", id);
    fetchCustomers();
  };

  const filtered = customers.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Kişiler
            </h1>
            <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
              {customers.length} müşteri kayıtlı
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setForm({ full_name: "", phone: "" });
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95"
          >
            <Plus size={20} strokeWidth={2.5} />
            Yeni Müşteri
          </button>
        </div>
        
        <div className="relative w-full">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..."
            className="w-full rounded-2xl border-0 bg-white/60 py-3.5 pl-11 pr-4 text-base text-gray-900 placeholder-gray-400 shadow-[0_4px_20px_rgb(0,0,0,0.03)] backdrop-blur-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder-slate-500 transition-all"
          />
        </div>
      </div>

      {/* iOS Contacts Style List */}
      <div className="overflow-hidden rounded-[32px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/50 dark:border-slate-700/50">
        <div className="flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
              Yükleniyor...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {search ? "Sonuç bulunamadı" : "Kişi yok"}
              </p>
            </div>
          ) : (
            filtered.map((customer, index) => (
              <div key={customer.id} className="group relative">
                {/* Inset Divider (starts after the avatar) */}
                {index !== 0 && (
                  <div className="absolute top-0 right-0 left-[76px] h-[1px] bg-gray-200/50 dark:bg-slate-700/50" />
                )}
                
                <div className="flex items-center justify-between p-4 pl-5 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-lg font-semibold text-gray-700 shadow-inner dark:from-slate-700 dark:to-slate-800 dark:text-slate-300">
                      {customer.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    
                    <div>
                      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">
                        {customer.full_name}
                      </h3>
                      {customer.phone && (
                        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                          {customer.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Badge for appointments */}
                    {customer.appointment_count ? (
                      <div className="hidden sm:flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 mr-2">
                        <CalendarDays size={12} />
                        {customer.appointment_count}
                      </div>
                    ) : null}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCustomer(customer);
                        setForm({ full_name: customer.full_name, phone: customer.phone || "" });
                        setModalOpen(true);
                      }}
                      className="rounded-full p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(customer.id);
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
                {editingCustomer ? "Müşteri Düzenle" : "Yeni Müşteri"}
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
                  Ad Soyad
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                  placeholder="Örn: Ahmet Yılmaz"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="block w-full rounded-2xl border-0 bg-white/50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300/50 backdrop-blur-xl focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:focus:ring-indigo-500 transition-all"
                  placeholder="Örn: 0555 555 5555"
                />
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
