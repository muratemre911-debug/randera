"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Clock,
  Sliders,
  Save,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Info
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface WorkingDay {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface WorkingHours {
  [key: string]: WorkingDay;
}

interface BookingRules {
  slotDuration: number;
  autoApprove: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
}

const defaultWorkingHours: WorkingHours = {
  pazartesi: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  sali: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  carsamba: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  persembe: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  cuma: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  cumartesi: { isOpen: true, openTime: "10:00", closeTime: "16:00" },
  pazar: { isOpen: false, openTime: "00:00", closeTime: "00:00" },
};

const defaultBookingRules: BookingRules = {
  slotDuration: 30,
  autoApprove: true,
  notifyEmail: true,
  notifySms: false,
  notifyWhatsapp: false,
};

const daysTranslation: { [key: string]: string } = {
  pazartesi: "Pazartesi",
  sali: "Salı",
  carsamba: "Çarşamba",
  persembe: "Perşembe",
  cuma: "Cuma",
  cumartesi: "Cumartesi",
  pazar: "Pazar",
};

export default function AyarlarPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"profile" | "hours" | "booking">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    description: "",
  });
  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);
  const [bookingRules, setBookingRules] = useState<BookingRules>(defaultBookingRules);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const currentTenantId = user.id;
        setTenantId(currentTenantId);

        const localProfile = localStorage.getItem(`tenant_profile_${currentTenantId}`);
        const localHours = localStorage.getItem(`tenant_hours_${currentTenantId}`);
        const localRules = localStorage.getItem(`tenant_rules_${currentTenantId}`);

        if (localProfile) setProfile(JSON.parse(localProfile));
        if (localHours) setWorkingHours(JSON.parse(localHours));
        if (localRules) setBookingRules(JSON.parse(localRules));

        const { data, error } = await supabase
          .from("tenants")
          .select("name, phone, email, address")
          .eq("id", currentTenantId)
          .single();

        if (data && !error) {
          setProfile((prev) => ({
            ...prev,
            name: data.name || "",
            phone: data.phone || "",
            email: data.email || "",
            address: data.address || "",
          }));
          
          localStorage.setItem(
            `tenant_profile_${currentTenantId}`,
            JSON.stringify({
              ...profile,
              name: data.name || "",
              phone: data.phone || "",
              email: data.email || "",
              address: data.address || "",
            })
          );
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    try {
      localStorage.setItem(`tenant_profile_${tenantId}`, JSON.stringify(profile));
      localStorage.setItem(`tenant_hours_${tenantId}`, JSON.stringify(workingHours));
      localStorage.setItem(`tenant_rules_${tenantId}`, JSON.stringify(bookingRules));

      const { error } = await supabase.from("tenants").upsert({
        id: tenantId,
        name: profile.name,
        slug: profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
      });

      if (error) {
        console.warn("Supabase upsert failed, using localStorage fallback:", error);
        showToast("success", "Ayarlar kaydedildi (Yerel veri güncellendi).");
      } else {
        showToast("success", "Ayarlar başarıyla güncellendi.");
      }
    } catch (err) {
      console.error("Save error:", err);
      showToast("error", "Bir hata oluştu, ayarlar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen,
      },
    }));
  };

  const handleTimeChange = (day: string, type: "openTime" | "closeTime", value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value,
      },
    }));
  };

  // Reusable iOS-style Switch Toggle Component
  const ToggleSwitch = ({ checked, onChange, disabled = false }: { checked: boolean, onChange: () => void, disabled?: boolean }) => (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${
        checked ? "bg-[#34C759]" : "bg-gray-300/80 dark:bg-[#39393D]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-[27px] w-[27px] transform rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="mb-8 pl-2">
        <h1 className="text-[34px] font-extrabold tracking-tight text-gray-900 dark:text-white">Ayarlar</h1>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-3xl transition-all duration-300 animate-in fade-in slide-in-from-top-8 ${
            toast.type === "success"
              ? "border-emerald-500/20 bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300"
              : "border-red-500/20 bg-red-50/90 text-red-800 dark:bg-red-950/90 dark:text-red-300"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-[15px] font-semibold">{toast.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar Menu (iPad Settings Style) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="overflow-hidden rounded-[20px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
            <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "profile" 
                    ? "bg-indigo-50/50 dark:bg-indigo-500/10" 
                    : "hover:bg-white/40 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#007AFF] text-white">
                  <Building2 size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[17px] font-medium ${activeTab === "profile" ? "text-[#007AFF] dark:text-[#0A84FF]" : "text-gray-900 dark:text-white"}`}>
                    İşletme Profili
                  </span>
                </div>
                <ChevronRight size={20} className="text-gray-400 dark:text-slate-500" />
              </button>

              <button
                onClick={() => setActiveTab("hours")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "hours" 
                    ? "bg-indigo-50/50 dark:bg-indigo-500/10" 
                    : "hover:bg-white/40 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#FF9500] text-white">
                  <Clock size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[17px] font-medium ${activeTab === "hours" ? "text-[#007AFF] dark:text-[#0A84FF]" : "text-gray-900 dark:text-white"}`}>
                    Çalışma Saatleri
                  </span>
                </div>
                <ChevronRight size={20} className="text-gray-400 dark:text-slate-500" />
              </button>

              <button
                onClick={() => setActiveTab("booking")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "booking" 
                    ? "bg-indigo-50/50 dark:bg-indigo-500/10" 
                    : "hover:bg-white/40 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#5856D6] text-white">
                  <Sliders size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[17px] font-medium ${activeTab === "booking" ? "text-[#007AFF] dark:text-[#0A84FF]" : "text-gray-900 dark:text-white"}`}>
                    Randevu Kuralları
                  </span>
                </div>
                <ChevronRight size={20} className="text-gray-400 dark:text-slate-500" />
              </button>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#007AFF] px-6 py-4 text-[17px] font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 dark:bg-[#0A84FF] dark:hover:bg-blue-500"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save size={20} />
                Ayarları Kaydet
              </>
            )}
          </button>
        </div>

        {/* Right Content Area (iOS Inset Grouped List Style) */}
        <div className="lg:col-span-8">
          <form id="settings-form" onSubmit={handleSave} className="space-y-8">
            
            {/* 1. BUSINESS PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-2 pl-4">
                  <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    Genel Bilgiler
                  </h2>
                </div>
                <div className="overflow-hidden rounded-[20px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
                    {/* Input Group */}
                    <div className="flex items-center px-4 py-3 min-h-[44px]">
                      <label className="w-[120px] shrink-0 text-[17px] text-gray-900 dark:text-white">İsim</label>
                      <input
                        type="text"
                        required
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        placeholder="İşletme Adı"
                        className="flex-1 bg-transparent text-[17px] text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white dark:placeholder-slate-500"
                      />
                    </div>
                    
                    <div className="flex items-center px-4 py-3 min-h-[44px]">
                      <label className="w-[120px] shrink-0 text-[17px] text-gray-900 dark:text-white">Telefon</label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="05XX XXX XX XX"
                        className="flex-1 bg-transparent text-[17px] text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white dark:placeholder-slate-500"
                      />
                    </div>

                    <div className="flex items-center px-4 py-3 min-h-[44px]">
                      <label className="w-[120px] shrink-0 text-[17px] text-gray-900 dark:text-white">E-posta</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        placeholder="info@ornek.com"
                        className="flex-1 bg-transparent text-[17px] text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white dark:placeholder-slate-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 mb-2 pl-4">
                  <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    Adres & Detaylar
                  </h2>
                </div>
                <div className="overflow-hidden rounded-[20px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
                    <div className="px-4 py-3 min-h-[88px]">
                      <label className="block text-[17px] text-gray-900 dark:text-white mb-1">Açık Adres</label>
                      <textarea
                        rows={2}
                        value={profile.address}
                        onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        placeholder="Müşterilerin sizi bulabileceği tam adres..."
                        className="w-full bg-transparent text-[17px] text-gray-500 placeholder-gray-400 focus:outline-none resize-none dark:text-slate-400 dark:placeholder-slate-600"
                      />
                    </div>
                    <div className="px-4 py-3 min-h-[110px]">
                      <label className="block text-[17px] text-gray-900 dark:text-white mb-1">Hakkımızda</label>
                      <textarea
                        rows={3}
                        value={profile.description}
                        onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                        placeholder="İşletmeniz ve hizmetleriniz hakkında açıklama..."
                        className="w-full bg-transparent text-[17px] text-gray-500 placeholder-gray-400 focus:outline-none resize-none dark:text-slate-400 dark:placeholder-slate-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. WORKING HOURS TAB */}
            {activeTab === "hours" && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-2 pl-4">
                  <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    Haftalık Saatler
                  </h2>
                </div>
                <div className="overflow-hidden rounded-[20px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
                    {Object.keys(workingHours).map((day) => {
                      const info = workingHours[day];
                      return (
                        <div key={day} className="flex flex-col py-3 px-4 min-h-[60px] sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center justify-between sm:w-44 shrink-0">
                            <span className="text-[17px] font-medium text-gray-900 dark:text-white">
                              {daysTranslation[day]}
                            </span>
                            <div className="sm:hidden">
                              <ToggleSwitch checked={info.isOpen} onChange={() => handleDayToggle(day)} />
                            </div>
                          </div>
                          
                          <div className="flex flex-1 items-center justify-between">
                            {info.isOpen ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={info.openTime}
                                  onChange={(e) => handleTimeChange(day, "openTime", e.target.value)}
                                  className="rounded-lg bg-gray-100/80 px-3 py-1.5 text-[17px] text-[#007AFF] font-medium focus:outline-none dark:bg-slate-800 dark:text-[#0A84FF]"
                                />
                                <span className="text-gray-400 font-bold px-1">ile</span>
                                <input
                                  type="time"
                                  value={info.closeTime}
                                  onChange={(e) => handleTimeChange(day, "closeTime", e.target.value)}
                                  className="rounded-lg bg-gray-100/80 px-3 py-1.5 text-[17px] text-[#007AFF] font-medium focus:outline-none dark:bg-slate-800 dark:text-[#0A84FF]"
                                />
                              </div>
                            ) : (
                              <span className="text-[17px] text-gray-400 dark:text-slate-500">Kapalı</span>
                            )}
                            
                            <div className="hidden sm:block ml-4">
                              <ToggleSwitch checked={info.isOpen} onChange={() => handleDayToggle(day)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. BOOKING RULES TAB */}
            {activeTab === "booking" && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-2 pl-4">
                  <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    Genel Kurallar
                  </h2>
                </div>
                <div className="overflow-hidden rounded-[20px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
                    
                    <div className="flex items-center justify-between px-4 py-3 min-h-[44px]">
                      <span className="text-[17px] text-gray-900 dark:text-white">Randevu Aralığı</span>
                      <div className="relative">
                        <select
                          value={bookingRules.slotDuration}
                          onChange={(e) =>
                            setBookingRules({ ...bookingRules, slotDuration: parseInt(e.target.value) })
                          }
                          className="appearance-none bg-transparent text-[17px] text-gray-500 pr-4 text-right focus:outline-none cursor-pointer dark:text-slate-400"
                        >
                          <option value={15}>15 Dakika</option>
                          <option value={30}>30 Dakika</option>
                          <option value={45}>45 Dakika</option>
                          <option value={60}>60 Dakika</option>
                          <option value={90}>90 Dakika</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
                          <ChevronRight size={18} className="text-gray-400" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 min-h-[44px]">
                      <span className="text-[17px] text-gray-900 dark:text-white">Otomatik Onay</span>
                      <ToggleSwitch 
                        checked={bookingRules.autoApprove} 
                        onChange={() => setBookingRules({ ...bookingRules, autoApprove: !bookingRules.autoApprove })} 
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 pl-4 flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-slate-400">
                  <Info size={14} />
                  Otomatik onay açıkken yeni randevular direkt olarak kabul edilir.
                </div>

                <div className="mt-8 mb-2 pl-4">
                  <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    Bildirim Kanalları
                  </h2>
                </div>
                <div className="overflow-hidden rounded-[20px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
                    
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-[17px] text-gray-900 dark:text-white">E-posta Bildirimi</span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">Yeni randevu ve iptal bildirimleri</span>
                      </div>
                      <ToggleSwitch 
                        checked={bookingRules.notifyEmail} 
                        onChange={() => setBookingRules({ ...bookingRules, notifyEmail: !bookingRules.notifyEmail })} 
                      />
                    </div>

                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-[17px] text-gray-900 dark:text-white">SMS Bildirimi</span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">Hatırlatma SMS'i gönderimi (Premium)</span>
                      </div>
                      <ToggleSwitch 
                        checked={bookingRules.notifySms} 
                        onChange={() => setBookingRules({ ...bookingRules, notifySms: !bookingRules.notifySms })} 
                      />
                    </div>

                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-[17px] text-gray-900 dark:text-white">WhatsApp</span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">WhatsApp'tan randevu onayı (Premium)</span>
                      </div>
                      <ToggleSwitch 
                        checked={bookingRules.notifyWhatsapp} 
                        onChange={() => setBookingRules({ ...bookingRules, notifyWhatsapp: !bookingRules.notifyWhatsapp })} 
                      />
                    </div>

                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
