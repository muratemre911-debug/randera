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
  Info,
  Image
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/CustomSelect";

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

const daysTranslationTR: { [key: string]: string } = {
  pazartesi: "Pazartesi",
  sali: "Salı",
  carsamba: "Çarşamba",
  persembe: "Perşembe",
  cuma: "Cuma",
  cumartesi: "Cumartesi",
  pazar: "Pazar",
};

const daysTranslationEN: { [key: string]: string } = {
  pazartesi: "Monday",
  sali: "Tuesday",
  carsamba: "Wednesday",
  persembe: "Thursday",
  cuma: "Friday",
  cumartesi: "Saturday",
  pazar: "Sunday",
};

import citiesData from "@/lib/cities.json";

export default function AyarlarPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();
  const daysTranslation = lang === "tr" ? daysTranslationTR : daysTranslationEN;
  const [activeTab, setActiveTab] = useState<"profile" | "hours" | "booking" | "vitrin">("profile");
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

  // Vitrin / Konum states
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [sector, setSector] = useState("");
  const [sectorsList, setSectorsList] = useState<{name:string, value:string}[]>([]);

  // Load settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profileData } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        const currentTenantId = profileData?.tenant_id;
        if (!currentTenantId) {
          setLoading(false);
          return;
        }
        setTenantId(currentTenantId);

        const localProfile = localStorage.getItem(`tenant_profile_${currentTenantId}`);
        const localHours = localStorage.getItem(`tenant_hours_${currentTenantId}`);
        const localRules = localStorage.getItem(`tenant_rules_${currentTenantId}`);

        if (localProfile) setProfile(JSON.parse(localProfile));
        if (localHours) setWorkingHours(JSON.parse(localHours));
        if (localRules) setBookingRules(JSON.parse(localRules));

        const { data, error } = await supabase
          .from("tenants")
          .select("name, phone, email, address, description, province, district, profile_image_url, cover_image_url, sector, working_hours")
          .eq("id", currentTenantId)
          .single();

        const sectorRes = await fetch('/api/admin/sectors');
        const sectorData = await sectorRes.json();
        
        if (Array.isArray(sectorData)) {
          setSectorsList(sectorData);
        }

        if (data && !error) {
          setProfile((prev) => ({
            ...prev,
            name: data.name || "",
            phone: data.phone || "",
            email: data.email || "",
            address: data.address || "",
            description: data.description || "",
          }));
          setProvince(data.province || "");
          setDistrict(data.district || "");
          setProfileImageUrl(data.profile_image_url || "");
          setCoverImageUrl(data.cover_image_url || "");
          setSector(data.sector || "");

          if (data.working_hours) {
            setWorkingHours(data.working_hours);
          }
          
          localStorage.setItem(
            `tenant_profile_${currentTenantId}`,
            JSON.stringify({
              ...profile,
              name: data.name || "",
              phone: data.phone || "",
              email: data.email || "",
              address: data.address || "",
              description: data.description || "",
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

    const normalizedHours = Object.fromEntries(
      Object.entries(workingHours).map(([day, h]) => [
        day,
        h.isOpen && h.openTime === "00:00" && h.closeTime === "00:00"
          ? { isOpen: true, openTime: "09:00", closeTime: "18:00" }
          : h,
      ])
    );

    try {
      localStorage.setItem(`tenant_profile_${tenantId}`, JSON.stringify(profile));
      localStorage.setItem(`tenant_hours_${tenantId}`, JSON.stringify(normalizedHours));
      localStorage.setItem(`tenant_rules_${tenantId}`, JSON.stringify(bookingRules));

      const res = await fetch('/api/tenant/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          address: profile.address,
          description: profile.description,
          province,
          district,
          profile_image_url: profileImageUrl,
          cover_image_url: coverImageUrl,
          sector,
          working_hours: normalizedHours,
        })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("API update failed:", data.error);
        showToast("error", data.error || "Sunucu hatası, ayarlar kaydedilemedi!");
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
    setWorkingHours((prev) => {
      const current = prev[day];
      if (!current.isOpen && current.openTime === "00:00" && current.closeTime === "00:00") {
        return {
          ...prev,
          [day]: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
        };
      }
      return {
        ...prev,
        [day]: {
          ...current,
          isOpen: !current.isOpen,
        },
      };
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {t("settings.title")}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {lang === "tr" ? "İşletme profili, çalışma saatleri ve randevu kurallarınızı yönetin." : "Manage business profile, hours, and booking rules."}
          </p>
        </div>

        {/* Header Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Ayarları Kaydet</span>
              </>
            )}
          </button>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Sidebar Menu */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-6 select-none">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "profile" 
                    ? "bg-indigo-50/70 dark:bg-indigo-500/10" 
                    : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[32px] w-[32px] items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Building2 size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[15px] font-bold ${activeTab === "profile" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}>
                    İşletme Profili
                  </span>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
              </button>

              <button
                onClick={() => setActiveTab("hours")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "hours" 
                    ? "bg-indigo-50/70 dark:bg-indigo-500/10" 
                    : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[32px] w-[32px] items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                  <Clock size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[15px] font-bold ${activeTab === "hours" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}>
                    Çalışma Saatleri
                  </span>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
              </button>

              <button
                onClick={() => setActiveTab("booking")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "booking" 
                    ? "bg-indigo-50/70 dark:bg-indigo-500/10" 
                    : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[32px] w-[32px] items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
                  <Sliders size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[15px] font-bold ${activeTab === "booking" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}>
                    Randevu Kuralları
                  </span>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
              </button>

              <button
                onClick={() => setActiveTab("vitrin")}
                className={`flex w-full items-center gap-4 px-4 py-3.5 transition-colors ${
                  activeTab === "vitrin" 
                    ? "bg-indigo-50/70 dark:bg-indigo-500/10" 
                    : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex h-[32px] w-[32px] items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                  <Image size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-[15px] font-bold ${activeTab === "vitrin" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}>
                    Konum & Vitrin
                  </span>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Content Area (iOS Inset Grouped List Style) */}
        <div className="lg:col-span-8">
          <form id="settings-form" onSubmit={handleSave} className="space-y-8">
            
            {/* 1. BUSINESS PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="animate-in fade-in duration-300 space-y-6">
                {/* Genel Bilgiler Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Genel Bilgiler
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Müşterilerinizin göreceği temel işletme iletişim bilgileri
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        İşletme Adı
                      </label>
                      <input
                        type="text"
                        required
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        placeholder="Örn: Kuaför Ahmet"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Telefon Numarası
                      </label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="05XX XXX XX XX"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        E-posta Adresi
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        placeholder="info@isletme.com"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Adres & Detaylar Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Adres & Detaylar
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Fiziksel konum ve işletmeniz hakkında tanıtıcı açıklama
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Açık Adres
                      </label>
                      <textarea
                        rows={3}
                        value={profile.address}
                        onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        placeholder="Müşterilerin sizi kolayca bulabileceği cadde, sokak ve açık adres..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Hakkımızda / İşletme Açıklaması
                      </label>
                      <textarea
                        rows={4}
                        value={profile.description}
                        onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                        placeholder="İşletmeniz, ekibiniz ve sunduğunuz deneyim hakkında müşterileri bilgilendirin..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all resize-none"
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
                          <div className="flex items-center justify-between sm:w-44 shrink-0 select-none">
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
                      <div className="w-40">
                        <CustomSelect
                          value={bookingRules.slotDuration}
                          onChange={(val) =>
                            setBookingRules({ ...bookingRules, slotDuration: parseInt(val) })
                          }
                          options={[
                            { value: 15, label: "15 Dakika" },
                            { value: 30, label: "30 Dakika" },
                            { value: 45, label: "45 Dakika" },
                            { value: 60, label: "60 Dakika" },
                            { value: 90, label: "90 Dakika" },
                          ]}
                          buttonClassName="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-900 transition-all hover:border-slate-300 focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white cursor-pointer"
                        />
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

            {/* 4. KONUM & VİTRİN TAB */}
            {activeTab === "vitrin" && (
              <div className="animate-in fade-in duration-300 space-y-6">
                {/* Konum Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Konum Bilgileri
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      İşletmenizin Keşfet sayfasında bulunacağı şehir ve ilçe
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        İl
                      </label>
                      <CustomSelect
                        value={province}
                        onChange={(val) => {
                          setProvince(val);
                          const districts = (citiesData as Record<string, string[]>)[val] || [];
                          setDistrict(districts.length > 0 ? districts[0] : "");
                        }}
                        options={Object.keys(citiesData)}
                        placeholder="İl Seçin"
                        searchable={true}
                        searchPlaceholder="İl ara (örn: İstanbul, İzmir)..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        İlçe
                      </label>
                      <CustomSelect
                        value={district}
                        onChange={(val) => setDistrict(val)}
                        options={(citiesData as Record<string, string[]>)[province] || []}
                        placeholder={province ? "İlçe Seçin" : "Önce il seçin"}
                        disabled={!province}
                        searchable={true}
                        searchPlaceholder="İlçe ara (örn: Kadıköy, Çankaya)..."
                      />
                    </div>
                  </div>
                </div>

                {/* Sektör Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Faaliyet Sektörü
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      İşletmenizin kategorize edileceği ana sektör
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Sektör
                    </label>
                    <CustomSelect
                      value={sector}
                      onChange={(val) => setSector(val)}
                      options={
                        sectorsList.length > 0
                          ? sectorsList.map((s) => ({ value: s.value, label: s.name }))
                          : [{ value: "Diğer", label: "Diğer" }]
                      }
                      placeholder="Sektör Seçin"
                      searchPlaceholder="Sektör ara..."
                    />
                  </div>
                </div>

                {/* Vitrin Görselleri Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Vitrin Görselleri
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Müşterilerinizi karşılayan kapak ve profil görselleri
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Profil Fotoğrafı URL
                      </label>
                      <input
                        type="text"
                        value={profileImageUrl}
                        onChange={(e) => setProfileImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                      {profileImageUrl && (
                        <div className="mt-3 flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profileImageUrl}
                            alt="Profil önizleme"
                            className="h-16 w-16 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                          />
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Profil fotoğrafı önizleme</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Kapak Fotoğrafı URL
                      </label>
                      <input
                        type="text"
                        value={coverImageUrl}
                        onChange={(e) => setCoverImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                      {coverImageUrl && (
                        <div className="mt-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverImageUrl}
                            alt="Kapak önizleme"
                            className="w-full h-36 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Bottom Save Action */}
            <div className="flex items-center justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Ayarları Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
