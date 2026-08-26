"use client";

import { useState, useEffect } from "react";
import { 
  Building2, Mail, Lock, User, Briefcase, Plus, Loader2, CheckCircle2, 
  ShieldAlert, Trash2, Tags, List, Settings, Edit3, Save, X, Bell, Send
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const SUPER_ADMIN_EMAILS = ["muratemre911@gmail.com", "muratemre912@gmail.com"];

export default function SuperAdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "manage" | "sectors" | "notifications">("create");
  const supabase = createClient();

  // Veriler
  const [sectors, setSectors] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  // Sektör Yönetimi
  const [newSector, setNewSector] = useState("");
  const [sectorLoading, setSectorLoading] = useState(false);

  // Hesap Açılışı
  const [form, setForm] = useState({ tenantName: "", fullName: "", sector: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mevcut İşletme Yönetimi
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ tenantName: "", email: "", password: "" });
  const [saveLoading, setSaveLoading] = useState(false);

  // Bildirim Gönderimi
  const [notifForm, setNotifForm] = useState({ title: "", message: "", targetType: "all", targetId: "", sectorValue: "", targetValue: "" });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState("");
  const [notifError, setNotifError] = useState("");
  
  // Bildirim Geçmişi (Silme)
  const [notifHistory, setNotifHistory] = useState<any[]>([]);
  const [notifHistoryLoading, setNotifHistoryLoading] = useState(false);

  useEffect(() => {
    async function checkAuthAndLoadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !SUPER_ADMIN_EMAILS.includes(user.email!)) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      fetchSectors();
    }
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if ((activeTab === "manage" || activeTab === "notifications") && tenants.length === 0) {
      fetchTenants();
    }
    if (activeTab === "notifications") {
      fetchNotificationHistory();
    }
  }, [activeTab]);

  const fetchNotificationHistory = async () => {
    setNotifHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (Array.isArray(data)) setNotifHistory(data);
    } finally {
      setNotifHistoryLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Bu bildirimi tamamen silmek istediğinize emin misiniz? (Kullanıcılardan da silinir)")) return;
    try {
      const res = await fetch(`/api/admin/notifications?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotifHistory(prev => prev.filter(n => n.id !== id));
      } else {
        alert("Silinirken hata oluştu!");
      }
    } catch (e) { console.error(e); }
  };

  const fetchSectors = async () => {
    const res = await fetch("/api/admin/sectors");
    const data = await res.json();
    if (Array.isArray(data)) {
      setSectors(data);
      if (data.length > 0 && !form.sector) setForm(prev => ({ ...prev, sector: data[0].value }));
      if (data.length > 0 && !notifForm.sectorValue) setNotifForm(prev => ({ ...prev, sectorValue: data[0].value }));
    }
  };

  const fetchTenants = async () => {
    setTenantsLoading(true);
    const res = await fetch("/api/admin/tenants");
    const data = await res.json();
    if (Array.isArray(data)) {
      setTenants(data);
      if (data.length > 0 && !notifForm.targetId) setNotifForm(prev => ({ ...prev, targetId: data[0].tenantId }));
    }
    setTenantsLoading(false);
  };

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSector.trim()) return;
    setSectorLoading(true);
    try {
      const value = newSector.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const res = await fetch("/api/admin/sectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newSector, value }) });
      if (res.ok) { setNewSector(""); fetchSectors(); } else alert((await res.json()).error);
    } finally { setSectorLoading(false); }
  };

  const handleDeleteSector = async (id: string) => {
    if (!confirm("Silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/admin/sectors?id=${id}`, { method: "DELETE" });
    fetchSectors();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/create-tenant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("İşletme başarıyla açıldı!");
      setForm({ tenantName: "", fullName: "", sector: sectors[0]?.value || "", email: "", password: "" });
      fetchTenants(); 
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleStartEdit = (t: any) => { setEditingTenant(t.tenantId); setEditForm({ tenantName: t.tenantName, email: t.email !== "Bulunamadı" ? t.email : "", password: "" }); };

  const handleSaveEdit = async (tenantId: string, userId: string) => {
    setSaveLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, userId, ...editForm }) });
      if (res.ok) { setEditingTenant(null); fetchTenants(); } else alert((await res.json()).error);
    } finally { setSaveLoading(false); }
  };

  const handleDeleteTenant = async (tenantId: string, userId: string, tenantName: string) => {
    if (!confirm(`DİKKAT: "${tenantName}" SİLİNECEK. Devam?`)) return;
    await fetch(`/api/admin/tenants?tenantId=${tenantId}&userId=${userId}`, { method: "DELETE" });
    fetchTenants();
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifLoading(true); setNotifError(""); setNotifSuccess("");
    try {
      const res = await fetch("/api/admin/send-notification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotifSuccess(`Bildirim başarıyla ${data.sentCount} işletmeye gönderildi!`);
      setNotifForm({ ...notifForm, title: "", message: "" });
      fetchNotificationHistory();
    } catch (err: any) { setNotifError(err.message); } finally { setNotifLoading(false); }
  };


  if (authorized === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-red-100">
          <ShieldAlert className="mx-auto text-red-500 h-16 w-16 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Yetkisiz Erişim</h1>
          <Link href="/login" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4 inline-block">Sisteme Giriş Yap</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 flex justify-center">
      <div className="max-w-5xl w-full flex flex-col gap-6">
        
        <div className="bg-white rounded-3xl shadow-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Building2 className="text-white h-6 w-6" /></div>
            <div><h1 className="text-xl font-bold text-slate-800">Süper Admin</h1><p className="text-slate-500 text-xs">Sistem Yönetimi</p></div>
          </div>
          <div className="flex flex-wrap justify-center bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab("create")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "create" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Plus size={16} /> Hesap Aç</button>
            <button onClick={() => setActiveTab("manage")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "manage" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><List size={16} /> İşletmeler</button>
            <button onClick={() => setActiveTab("sectors")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "sectors" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Tags size={16} /> Sektörler</button>
            <button onClick={() => setActiveTab("notifications")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "notifications" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Bell size={16} /> Bildirimler</button>
          </div>
        </div>

        {activeTab === "create" && (
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-2xl mx-auto w-full animate-modal-in">
            <h2 className="text-xl font-bold mb-6">Yeni İşletme Profili Oluştur</h2>
            {error && <div className="mb-4 p-4 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}
            {success && <div className="mb-4 p-4 bg-emerald-50 text-emerald-600 text-sm rounded-xl">{success}</div>}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div><label className="block text-sm font-semibold mb-1">İşletme Adı</label><input required type="text" value={form.tenantName} onChange={e => setForm({...form, tenantName: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 focus:ring-2" /></div>
              <div><label className="block text-sm font-semibold mb-1">Yetkili Adı</label><input required type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 focus:ring-2" /></div>
              <div>
                <label className="block text-sm font-semibold mb-1">Sektör</label>
                <select required value={form.sector} onChange={e => setForm({...form, sector: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500 focus:ring-2 bg-white">
                  {sectors.map(s => <option key={s.id} value={s.value}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold mb-1">E-Posta</label><input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-sm font-semibold mb-1">Şifre</label><input required type="password" minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500" /></div>
              </div>
              <button disabled={loading} type="submit" className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">{loading ? <Loader2 className="animate-spin" /> : <Plus />} Oluştur</button>
            </form>
          </div>
        )}

        {activeTab === "manage" && (
          <div className="bg-white rounded-3xl shadow-xl p-6 animate-modal-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><List className="text-indigo-500" /> Mevcut İşletmeler</h2>
            {tenantsLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" size={30} /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                    <tr><th className="px-4 py-3">İşletme Adı</th><th className="px-4 py-3">Sektör</th><th className="px-4 py-3">E-Posta</th><th className="px-4 py-3 text-right">İşlem</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenants.map(t => (
                      <tr key={t.tenantId}>
                        <td className="px-4 py-4 font-medium">{editingTenant === t.tenantId ? <input type="text" value={editForm.tenantName} onChange={e => setEditForm({...editForm, tenantName: e.target.value})} className="px-2 py-1 border rounded w-full outline-none focus:border-indigo-500" /> : t.tenantName}</td>
                        <td className="px-4 py-4">{sectors.find(s=>s.value === t.sector)?.name || t.sector}</td>
                        <td className="px-4 py-4">{editingTenant === t.tenantId ? <div className="flex flex-col gap-1"><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="px-2 py-1 border rounded outline-none" /><input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Yeni Şifre" className="px-2 py-1 border rounded outline-none" /></div> : t.email}</td>
                        <td className="px-4 py-4 text-right">
                          {editingTenant === t.tenantId ? (
                            <div className="flex justify-end gap-2"><button onClick={() => handleSaveEdit(t.tenantId, t.userId)} disabled={saveLoading} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Save size={16} /></button><button onClick={() => setEditingTenant(null)} className="p-1.5 bg-slate-100 rounded-lg"><X size={16} /></button></div>
                          ) : (
                            <div className="flex justify-end gap-2"><button onClick={() => handleStartEdit(t)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Edit3 size={16} /></button><button onClick={() => handleDeleteTenant(t.tenantId, t.userId, t.tenantName)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "sectors" && (
          <div className="bg-white rounded-3xl shadow-xl p-6 max-w-lg mx-auto w-full animate-modal-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Tags className="text-indigo-500" /> Sektör Yönetimi</h2>
            <form onSubmit={handleAddSector} className="flex gap-2 mb-6"><input type="text" value={newSector} onChange={e => setNewSector(e.target.value)} placeholder="Yeni sektör" className="flex-1 px-4 py-2 border rounded-xl outline-none" /><button disabled={sectorLoading} className="bg-indigo-600 text-white px-5 rounded-xl font-semibold">Ekle</button></form>
            <div className="space-y-2">
              {sectors.map(sector => <div key={sector.id} className="flex items-center justify-between p-3 border rounded-xl bg-slate-50"><span className="font-medium">{sector.name}</span><button onClick={() => handleDeleteSector(sector.id)} className="text-red-400 p-1"><Trash2 size={16} /></button></div>)}
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-5xl mx-auto w-full animate-modal-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Send className="text-indigo-500" /> Bildirim Yönetimi</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Sol Taraf: Bildirim Gönder */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Yeni Bildirim Gönder</h3>
                {notifError && <div className="mb-4 p-4 bg-red-50 text-red-600 text-sm rounded-xl">{notifError}</div>}
                {notifSuccess && <div className="mb-4 p-4 bg-emerald-50 text-emerald-600 text-sm rounded-xl">{notifSuccess}</div>}
                
                <form onSubmit={handleSendNotification} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Hedef Kitle</label>
                    <select value={notifForm.targetType} onChange={e => setNotifForm({...notifForm, targetType: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none bg-white">
                      <option value="all">Sistemdeki Tüm İşletmelere (Herkes)</option>
                      <option value="sector">Sadece Belirli Bir Sektöre</option>
                      <option value="single">Sadece Tek Bir İşletmeye</option>
                    </select>
                  </div>

                  {notifForm.targetType === "sector" && (
                    <div className="animate-in fade-in zoom-in-95">
                      <label className="block text-sm font-semibold mb-1 text-indigo-600">Sektör Seçin</label>
                      <select value={notifForm.targetValue} onChange={e => setNotifForm({...notifForm, targetValue: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 outline-none bg-indigo-50/30">
                        {sectors.map(s => <option key={s.id} value={s.value}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  {notifForm.targetType === "single" && (
                    <div className="animate-in fade-in zoom-in-95">
                      <label className="block text-sm font-semibold mb-1 text-indigo-600">İşletme Seçin</label>
                      <select value={notifForm.targetValue} onChange={e => setNotifForm({...notifForm, targetValue: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 outline-none bg-indigo-50/30">
                        {tenants.map(t => <option key={t.tenantId} value={t.tenantId}>{t.tenantName}</option>)}
                      </select>
                    </div>
                  )}

                  <hr className="border-gray-100" />

                  <div><label className="block text-sm font-semibold mb-1">Bildirim Başlığı</label><input required type="text" value={notifForm.title} onChange={e => setNotifForm({...notifForm, title: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500" placeholder="Örn: Önemli Sistem Bakımı" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Mesaj İçeriği</label><textarea required rows={3} value={notifForm.message} onChange={e => setNotifForm({...notifForm, message: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-indigo-500" placeholder="İşletmelerin telefonuna düşecek olan asıl mesaj metni..."></textarea></div>

                  <button disabled={notifLoading} type="submit" className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">{notifLoading ? <Loader2 className="animate-spin" /> : <Send size={18} />} Bildirimi Yolla (Push)</button>
                </form>
              </div>

              {/* Sağ Taraf: Gönderilenler (Silme) */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex justify-between items-center">
                  Gönderilenler Geçmişi
                  <button onClick={fetchNotificationHistory} className="text-indigo-500 hover:text-indigo-700 p-1"><List size={18} /></button>
                </h3>
                
                <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                  {notifHistoryLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" size={30} /></div>
                  ) : notifHistory.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Geçmiş bildirim bulunmuyor.</div>
                  ) : (
                    notifHistory.map((n: any) => (
                      <div key={n.id} className="p-3 border rounded-xl bg-slate-50 flex items-start justify-between gap-3 hover:bg-slate-100 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md truncate max-w-[120px]">
                              {n.tenants?.name || "Bilinmiyor"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleDateString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteNotification(n.id)}
                          className="p-2 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors shrink-0"
                          title="Bildirimi Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
