"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Clock,
  Sliders,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Info,
  Search,
  Check,
  Image as ImageIcon,
  Camera,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/CustomSelect";
import ImageCropper from "@/components/ImageCropper";
import MapPoint from "@/components/MapPoint";
import { buildAddressQuery } from "@/lib/address";
import { PROVINCE_COORDS } from "@/lib/provinceCoords";
import { PALETTES, getPalette, paletteCss } from "@/lib/palettes";

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
  cancelDeadlineHours: number;
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
  cancelDeadlineHours: 24,
};

// iOS tarzı açma/kapama anahtarı
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
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
}

// Haftalık saatler Pazartesi'den Pazar'a listelenir. `working_hours` JSONB olarak
// saklandığı için anahtar sırası garanti değil (Postgres jsonb anahtarları
// uzunluk/sıraya göre döndürür) — sıralamayı her zaman bu listeyle yapıyoruz.
const WEEK_DAYS = [
  "pazartesi",
  "sali",
  "carsamba",
  "persembe",
  "cuma",
  "cumartesi",
  "pazar",
] as const;

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
  const [activeTab, setActiveTab] = useState<
    "profile" | "hours" | "booking" | "vitrin"
  >("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form states
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    description: "",
  });
  const [workingHours, setWorkingHours] =
    useState<WorkingHours>(defaultWorkingHours);
  const [bookingRules, setBookingRules] =
    useState<BookingRules>(defaultBookingRules);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Vitrin / Konum states
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNo, setBuildingNo] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  // İşletme sayfası tema paleti + önizleme varyantı
  const [themePalette, setThemePalette] = useState("indigo");
  const [previewDark, setPreviewDark] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  /** Kırpma penceresi açıkken seçilen dosyanın object URL'i */
  const [cropping, setCropping] = useState<{
    kind: "profile" | "cover";
    src: string;
  } | null>(null);
  const [mediaSaving, setMediaSaving] = useState<"profile" | "cover" | null>(
    null,
  );
  const [sector, setSector] = useState("");
  const [sectorsList, setSectorsList] = useState<
    { name: string; value: string }[]
  >([]);

  // Load settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
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

        const localProfile = localStorage.getItem(
          `tenant_profile_${currentTenantId}`,
        );
        const localHours = localStorage.getItem(
          `tenant_hours_${currentTenantId}`,
        );
        const localRules = localStorage.getItem(
          `tenant_rules_${currentTenantId}`,
        );

        if (localProfile) setProfile(JSON.parse(localProfile));
        if (localHours) setWorkingHours(JSON.parse(localHours));
        if (localRules) setBookingRules(JSON.parse(localRules));

        const { data, error } = await supabase
          .from("tenants")
          .select(
            "name, phone, email, address, description, province, district, neighborhood, street, building_no, latitude, longitude, theme_palette, profile_image_url, cover_image_url, sector, working_hours, booking_rules",
          )
          .eq("id", currentTenantId)
          .single();

        // Konum kolonları henüz eklenmemişse (migration) eski kolonlarla devam et
        const locationData = error
          ? (
              await supabase
                .from("tenants")
                .select(
                  "name, phone, email, address, description, province, district, profile_image_url, cover_image_url, sector, working_hours, booking_rules",
                )
                .eq("id", currentTenantId)
                .single()
            ).data
          : data;

        const sectorRes = await fetch("/api/admin/sectors");
        const sectorData = await sectorRes.json();

        if (Array.isArray(sectorData)) {
          setSectorsList(sectorData);
        }

        const t = locationData as
          | (typeof data & {
              neighborhood?: string | null;
              street?: string | null;
              building_no?: string | null;
              latitude?: number | null;
              longitude?: number | null;
              theme_palette?: string | null;
            })
          | null;

        if (t) {
          setProfile((prev) => ({
            ...prev,
            name: t.name || "",
            phone: t.phone || "",
            email: t.email || "",
            address: t.address || "",
            description: t.description || "",
          }));
          setProvince(t.province || "");
          setDistrict(t.district || "");
          setNeighborhood(t.neighborhood || "");
          setStreet(t.street || "");
          setBuildingNo(t.building_no || "");
          setCoords(
            t.latitude != null && t.longitude != null
              ? { lat: t.latitude, lng: t.longitude }
              : null,
          );
          setProfileImageUrl(t.profile_image_url || "");
          setCoverImageUrl(t.cover_image_url || "");
          setSector(t.sector || "");
          setThemePalette(t.theme_palette || "indigo");

          if (t.working_hours) {
            setWorkingHours(t.working_hours);
          }
          if (t.booking_rules) {
            setBookingRules({ ...defaultBookingRules, ...t.booking_rules });
          }

          localStorage.setItem(
            `tenant_profile_${currentTenantId}`,
            JSON.stringify({
              ...profile,
              name: t.name || "",
              phone: t.phone || "",
              email: t.email || "",
              address: t.address || "",
              description: t.description || "",
            }),
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

  // --- Vitrin görselleri: dosya seç -> kırp/ölçekle -> Supabase Storage'a yükle ---

  const closeCropper = () => {
    setCropping((prev) => {
      if (prev) URL.revokeObjectURL(prev.src);
      return null;
    });
  };

  const handlePickImage = (
    kind: "profile" | "cover",
    file: File | undefined,
  ) => {
    if (!file) return;
    setCropping({ kind, src: URL.createObjectURL(file) });
  };

  const handleCropSave = async (blob: Blob) => {
    if (!cropping || !tenantId) return;
    const kind = cropping.kind;
    setMediaSaving(kind);

    try {
      // Zaman damgalı yol: tarayıcı/CDN önbelleği eski fotoğrafı göstermesin.
      const path = `${tenantId}/${kind}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("tenants")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from("tenants").getPublicUrl(path);
      if (kind === "profile") setProfileImageUrl(data.publicUrl);
      else setCoverImageUrl(data.publicUrl);

      closeCropper();
      showToast(
        "success",
        "Fotoğraf yüklendi. Yayınlamak için Ayarları Kaydet'e basın.",
      );
    } catch (err) {
      console.error("Vitrin görseli yüklenemedi:", err);
      // Pencere kapanır: hata bildirimi (toast) panelin üstünde görünsün.
      closeCropper();
      showToast(
        "error",
        "Fotoğraf yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setMediaSaving(null);
    }
  };

  // Seçilen il/ilçeye göre mahalle listesi (turkiyeapi.dev, route üzerinden cache'li)
  useEffect(() => {
    if (!province || !district) return;
    let cancelled = false;
    fetch(
      `/api/neighborhoods?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled)
          setNeighborhoods(
            Array.isArray(d.neighborhoods) ? d.neighborhoods : [],
          );
      })
      .catch(() => {
        if (!cancelled) setNeighborhoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [province, district]);

  const clearNeighborhoods = () => {
    setNeighborhoods([]);
    setNeighborhood("");
  };

  // Yazılan adresi Nominatim ile bul ve pini oraya taşı
  const findOnMap = async () => {
    const query = buildAddressQuery({
      province,
      district,
      neighborhood,
      street,
      building_no: buildingNo,
    });
    if (!query) {
      showToast("error", "Önce il ve ilçe bilgisini seçin.");
      return;
    }
    setGeoLoading(true);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(`${query}, Türkiye`)}`,
      );
      const json = await res.json();
      if (json.result) {
        setCoords({ lat: json.result.lat, lng: json.result.lng });
        showToast(
          "success",
          "Adres bulundu. Gerekirse pini sürükleyerek düzeltin.",
        );
      } else {
        showToast(
          "error",
          "Adres bulunamadı. Pini haritadan elle seçebilirsiniz.",
        );
      }
    } catch {
      showToast("error", "Adres servisine ulaşılamadı.");
    } finally {
      setGeoLoading(false);
    }
  };

  // Pin taşındığında/bırakıldığında boş kalan adres alanlarını konumdan tamamla
  const handlePinChange = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
      const json = await res.json();
      const r = json.result;
      if (!r) return;
      setProvince((prev) => prev || r.province || "");
      setDistrict((prev) => prev || r.district || "");
      setNeighborhood((prev) => prev || r.neighborhood || "");
      setStreet((prev) => prev || r.street || "");
      setBuildingNo((prev) => prev || r.building_no || "");
    } catch {
      // konum kaydedildi, adres alanları elle doldurulabilir
    }
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
      ]),
    );

    try {
      localStorage.setItem(
        `tenant_profile_${tenantId}`,
        JSON.stringify(profile),
      );
      localStorage.setItem(
        `tenant_hours_${tenantId}`,
        JSON.stringify(normalizedHours),
      );
      localStorage.setItem(
        `tenant_rules_${tenantId}`,
        JSON.stringify(bookingRules),
      );

      const res = await fetch("/api/tenant/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          address: profile.address,
          description: profile.description,
          province,
          district,
          neighborhood,
          street,
          building_no: buildingNo,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          theme_palette: themePalette,
          profile_image_url: profileImageUrl,
          cover_image_url: coverImageUrl,
          sector,
          working_hours: normalizedHours,
          booking_rules: bookingRules,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("API update failed:", data.error);
        showToast(
          "error",
          data.error || "Sunucu hatası, ayarlar kaydedilemedi!",
        );
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
      // Kayıtta gün eksikse varsayılanı temel al (liste 7 günü de gösterir)
      const current = prev[day] ?? defaultWorkingHours[day];
      if (
        !current.isOpen &&
        current.openTime === "00:00" &&
        current.closeTime === "00:00"
      ) {
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

  const handleTimeChange = (
    day: string,
    type: "openTime" | "closeTime",
    value: string,
  ) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value,
      },
    }));
  };

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
            {lang === "tr"
              ? "İşletme profili, çalışma saatleri ve randevu kurallarınızı yönetin."
              : "Manage business profile, hours, and booking rules."}
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

      {/* Vitrin görseli kırpma penceresi */}
      {cropping && (
        <ImageCropper
          src={cropping.src}
          aspect={cropping.kind === "profile" ? 1 : 2}
          round={cropping.kind === "profile"}
          outputWidth={cropping.kind === "profile" ? 512 : 1600}
          title={
            cropping.kind === "profile"
              ? "Profil fotoğrafını ayarla"
              : "Kapak fotoğrafını ayarla"
          }
          saving={mediaSaving !== null}
          onCancel={closeCropper}
          onSave={handleCropSave}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-3xl transition-all duration-300 animate-in fade-in slide-in-from-top-8 ${
            toast.type === "success"
              ? "border-emerald-500/20 bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300"
              : "border-red-500/20 bg-red-50/90 text-red-800 dark:bg-red-950/90 dark:text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
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
                  <span
                    className={`text-[15px] font-bold ${activeTab === "profile" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}
                  >
                    İşletme Profili
                  </span>
                </div>
                <ChevronRight
                  size={18}
                  className="text-slate-400 dark:text-slate-500"
                />
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
                  <span
                    className={`text-[15px] font-bold ${activeTab === "hours" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}
                  >
                    Çalışma Saatleri
                  </span>
                </div>
                <ChevronRight
                  size={18}
                  className="text-slate-400 dark:text-slate-500"
                />
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
                  <span
                    className={`text-[15px] font-bold ${activeTab === "booking" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}
                  >
                    Randevu Kuralları
                  </span>
                </div>
                <ChevronRight
                  size={18}
                  className="text-slate-400 dark:text-slate-500"
                />
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
                  <ImageIcon size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left">
                  <span
                    className={`text-[15px] font-bold ${activeTab === "vitrin" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}
                  >
                    Konum & Vitrin
                  </span>
                </div>
                <ChevronRight
                  size={18}
                  className="text-slate-400 dark:text-slate-500"
                />
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
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
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
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
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
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
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
                        Açık Adres / Tarif (elle)
                      </label>
                      <textarea
                        rows={3}
                        value={profile.address}
                        onChange={(e) =>
                          setProfile({ ...profile, address: e.target.value })
                        }
                        placeholder="Müşterilerin sizi kolayca bulabileceği ek tarif (kat, daire, avm içi, yol tarifi...)"
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
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            description: e.target.value,
                          })
                        }
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
                    {WEEK_DAYS.map((day) => {
                      // Gün eksikse varsayılanla göster: aksi halde o günü açmak mümkün olmaz
                      const info =
                        workingHours[day] ?? defaultWorkingHours[day];
                      return (
                        <div
                          key={day}
                          className="flex flex-col py-3 px-4 min-h-[60px] sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center justify-between sm:w-44 shrink-0 select-none">
                            <span className="text-[17px] font-medium text-gray-900 dark:text-white">
                              {daysTranslation[day]}
                            </span>
                            <div className="sm:hidden">
                              <ToggleSwitch
                                checked={info.isOpen}
                                onChange={() => handleDayToggle(day)}
                              />
                            </div>
                          </div>

                          <div className="flex flex-1 items-center justify-between">
                            {info.isOpen ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={info.openTime}
                                  onChange={(e) =>
                                    handleTimeChange(
                                      day,
                                      "openTime",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-lg bg-gray-100/80 px-3 py-1.5 text-[17px] text-[#007AFF] font-medium focus:outline-none dark:bg-slate-800 dark:text-[#0A84FF]"
                                />
                                <span className="text-gray-400 font-bold px-1">
                                  ile
                                </span>
                                <input
                                  type="time"
                                  value={info.closeTime}
                                  onChange={(e) =>
                                    handleTimeChange(
                                      day,
                                      "closeTime",
                                      e.target.value,
                                    )
                                  }
                                  className="rounded-lg bg-gray-100/80 px-3 py-1.5 text-[17px] text-[#007AFF] font-medium focus:outline-none dark:bg-slate-800 dark:text-[#0A84FF]"
                                />
                              </div>
                            ) : (
                              <span className="text-[17px] text-gray-400 dark:text-slate-500">
                                Kapalı
                              </span>
                            )}

                            <div className="hidden sm:block ml-4">
                              <ToggleSwitch
                                checked={info.isOpen}
                                onChange={() => handleDayToggle(day)}
                              />
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
                      <span className="text-[17px] text-gray-900 dark:text-white">
                        Randevu Aralığı
                      </span>
                      <div className="w-40">
                        <CustomSelect
                          value={bookingRules.slotDuration}
                          onChange={(val) =>
                            setBookingRules({
                              ...bookingRules,
                              slotDuration: parseInt(val),
                            })
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
                      <div className="flex flex-col pr-3">
                        <span className="text-[17px] text-gray-900 dark:text-white">
                          İptal Süresi
                        </span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">
                          Müşteri randevuya bu süreden az kala doğrudan iptal
                          edemez, size istek gönderir
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={168}
                          value={bookingRules.cancelDeadlineHours}
                          onChange={(e) =>
                            setBookingRules({
                              ...bookingRules,
                              cancelDeadlineHours: Math.max(
                                0,
                                Math.min(168, parseInt(e.target.value) || 0),
                              ),
                            })
                          }
                          className="w-20 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 text-center focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white"
                        />
                        <span className="text-[15px] font-medium text-gray-500 dark:text-slate-400">
                          saat
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 min-h-[44px]">
                      <span className="text-[17px] text-gray-900 dark:text-white">
                        Otomatik Onay
                      </span>
                      <ToggleSwitch
                        checked={bookingRules.autoApprove}
                        onChange={() =>
                          setBookingRules({
                            ...bookingRules,
                            autoApprove: !bookingRules.autoApprove,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 pl-4 flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-slate-400">
                  <Info size={14} />
                  Otomatik onay açıkken yeni randevular direkt olarak kabul
                  edilir.
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
                        <span className="text-[17px] text-gray-900 dark:text-white">
                          E-posta Bildirimi
                        </span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">
                          Yeni randevu ve iptal bildirimleri
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={bookingRules.notifyEmail}
                        onChange={() =>
                          setBookingRules({
                            ...bookingRules,
                            notifyEmail: !bookingRules.notifyEmail,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-[17px] text-gray-900 dark:text-white">
                          SMS Bildirimi
                        </span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">
                          Hatırlatma SMS&apos;i gönderimi (Premium)
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={bookingRules.notifySms}
                        onChange={() =>
                          setBookingRules({
                            ...bookingRules,
                            notifySms: !bookingRules.notifySms,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-[17px] text-gray-900 dark:text-white">
                          WhatsApp
                        </span>
                        <span className="text-[13px] text-gray-500 dark:text-slate-400">
                          WhatsApp&apos;tan randevu onayı (Premium)
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={bookingRules.notifyWhatsapp}
                        onChange={() =>
                          setBookingRules({
                            ...bookingRules,
                            notifyWhatsapp: !bookingRules.notifyWhatsapp,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. KONUM & VİTRİN TAB */}
            {activeTab === "vitrin" && (
              <div className="animate-in fade-in duration-300 space-y-6">
                {/* Tema Rengi Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Tema Rengi
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Yalnızca işletme sayfanızda (müşterilerin gördüğü profil)
                      görünür. Müşteriniz koyu temadaysa paletin koyu, açık
                      temadaysa açık varyantı gösterilir.
                    </p>
                  </div>

                  <style>{paletteCss(getPalette(themePalette))}</style>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Önizleme */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Önizleme
                        </span>
                        <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setPreviewDark(false)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                              !previewDark
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            Açık
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDark(true)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                              previewDark
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            Koyu
                          </button>
                        </div>
                      </div>

                      <div
                        className={`brand-scope ${
                          previewDark ? "force-dark" : "force-light"
                        } rounded-3xl border overflow-hidden ${
                          previewDark
                            ? "border-slate-700 bg-slate-900"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="h-16 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)]" />
                        <div className="p-4 pt-0 space-y-3">
                          <div className="flex items-center gap-3 -mt-6">
                            <div className="h-12 w-12 rounded-2xl bg-[var(--brand)] shadow-[0_6px_20px_var(--brand-shadow)] ring-4 ring-white dark:ring-slate-900 flex items-center justify-center text-white text-sm font-black shrink-0">
                              R
                            </div>
                            <div className="min-w-0 pt-6">
                              <p
                                className={`text-sm font-black truncate ${
                                  previewDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                Örnek İşletme
                              </p>
                              <p className="text-[11px] font-bold text-amber-500">
                                ★ 4.9{" "}
                                <span
                                  className={`font-medium ${
                                    previewDark
                                      ? "text-slate-400"
                                      : "text-slate-500"
                                  }`}
                                >
                                  · Berber
                                </span>
                              </p>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)]">
                            Bugün Müsait
                          </span>

                          <div
                            className={`rounded-2xl border p-3 flex items-center justify-between ${
                              previewDark
                                ? "border-slate-700 bg-slate-800/40"
                                : "border-slate-200 bg-slate-50/60"
                            }`}
                          >
                            <div>
                              <p
                                className={`text-xs font-bold ${
                                  previewDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                Saç Kesimi
                              </p>
                              <p
                                className={`text-[11px] ${
                                  previewDark
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              >
                                30 dk · ₺350
                              </p>
                            </div>
                            <span className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold text-white bg-[var(--brand)] shadow-[0_4px_14px_var(--brand-shadow)]">
                              Seç
                            </span>
                          </div>

                          <div className="w-full rounded-2xl py-3 text-center text-sm font-extrabold text-white bg-[var(--brand)] shadow-[0_6px_20px_var(--brand-shadow)]">
                            Randevu Al
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Palet Seçimi */}
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        Palet Seçin ({PALETTES.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto p-1 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 custom-scrollbar">
                        {PALETTES.map((p) => {
                          const selected = themePalette === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setThemePalette(p.id)}
                              className={`flex items-center gap-2 p-2.5 rounded-2xl border text-left transition-all ${
                                selected
                                  ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20"
                                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600"
                              }`}
                            >
                              <span className="flex -space-x-2 shrink-0">
                                <span
                                  className="h-6 w-6 rounded-full border-2 border-white dark:border-slate-900"
                                  style={{ background: p.light.brand }}
                                />
                                <span
                                  className="h-6 w-6 rounded-full border-2 border-white dark:border-slate-900"
                                  style={{ background: p.dark.brand }}
                                />
                              </span>
                              <span
                                className={`text-xs font-bold truncate ${
                                  selected
                                    ? "text-indigo-700 dark:text-indigo-300"
                                    : "text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {p.name}
                              </span>
                              {selected && (
                                <Check
                                  size={14}
                                  className="ml-auto text-indigo-600 dark:text-indigo-400 shrink-0"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Soldaki daire açık tema, sağdaki daire koyu tema
                        rengidir. Kaydettikten sonra işletme sayfanızda bu renk
                        geçerli olur.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Konum Card */}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur-2xl shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Konum Bilgileri
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      İşletmenizin Keşfet sayfasında bulunacağı şehir ve ilçe
                    </p>{" "}
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
                          setDistrict("");
                          clearNeighborhoods();
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
                        onChange={(val) => {
                          setDistrict(val);
                          clearNeighborhoods();
                        }}
                        options={
                          (citiesData as Record<string, string[]>)[province] ||
                          []
                        }
                        placeholder={province ? "İlçe Seçin" : "Önce il seçin"}
                        disabled={!province}
                        searchable={true}
                        searchPlaceholder="İlçe ara (örn: Kadıköy, Çankaya)..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Mahalle
                      </label>
                      <input
                        type="text"
                        list="neighborhood-options"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder={
                          district
                            ? "Mahalle seçin veya yazın"
                            : "Önce ilçe seçin"
                        }
                        disabled={!district}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all disabled:opacity-60"
                      />
                      <datalist id="neighborhood-options">
                        {neighborhoods.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Cadde / Sokak
                      </label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="örn: Bağdat Caddesi"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        No
                      </label>
                      <input
                        type="text"
                        value={buildingNo}
                        onChange={(e) => setBuildingNo(e.target.value)}
                        placeholder="12/A"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-end gap-2 pb-1">
                      <button
                        type="button"
                        onClick={findOnMap}
                        disabled={geoLoading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 transition-all"
                      >
                        {geoLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Search size={16} />
                        )}
                        <span>Adresten Bul</span>
                      </button>
                      {coords && (
                        <button
                          type="button"
                          onClick={() => setCoords(null)}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                        >
                          Konumu Temizle
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Haritadaki Konum
                    </label>
                    <MapPoint
                      lat={coords?.lat ?? null}
                      lng={coords?.lng ?? null}
                      onChange={handlePinChange}
                      center={
                        province && PROVINCE_COORDS[province]
                          ? [
                              PROVINCE_COORDS[province].lat,
                              PROVINCE_COORDS[province].lng,
                            ]
                          : null
                      }
                      heightClass="h-72"
                    />
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Haritaya tıklayın veya pini sürükleyin. Boş bırakılan
                      adres alanları bu konumdan otomatik tamamlanır; kaydedilen
                      nokta müşterilere keşfet ve işletme sayfanızda gösterilir.
                    </p>
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
                          ? sectorsList.map((s) => ({
                              value: s.value,
                              label: s.name,
                            }))
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
                      Müşterilerinizi karşılayan kapak ve profil görselleri —
                      fotoğraf yükleyip dilediğiniz gibi ayarlayın.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Profil fotoğrafı */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Profil Fotoğrafı
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-indigo-500/70 bg-slate-100 shadow-sm dark:bg-slate-800">
                          {profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={profileImageUrl}
                              alt="Profil fotoğrafı"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <Camera size={22} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-2.5 text-[13px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 active:scale-95 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20">
                            <Upload size={15} />
                            {profileImageUrl ? "Değiştir" : "Fotoğraf Yükle"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handlePickImage("profile", e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Daire içine oturtulur; yakınlaştırıp
                            sürükleyebilirsiniz.
                          </p>
                          {profileImageUrl && (
                            <button
                              type="button"
                              onClick={() => setProfileImageUrl("")}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-500 transition-colors hover:text-red-600"
                            >
                              <Trash2 size={13} /> Fotoğrafı kaldır
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kapak fotoğrafı */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Kapak Fotoğrafı
                      </label>
                      <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                        {coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverImageUrl}
                            alt="Kapak fotoğrafı"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <ImageIcon size={26} />
                          </div>
                        )}

                        <label className="absolute right-3 bottom-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white active:scale-95 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:bg-slate-900">
                          <Upload size={14} />
                          {coverImageUrl ? "Değiştir" : "Fotoğraf Yükle"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              handlePickImage("cover", e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Kapak 2:1 oranında kırpılır; ortalamak için
                          sürükleyin.
                        </p>
                        {coverImageUrl && (
                          <button
                            type="button"
                            onClick={() => setCoverImageUrl("")}
                            className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-red-500 transition-colors hover:text-red-600"
                          >
                            <Trash2 size={13} /> Kaldır
                          </button>
                        )}
                      </div>
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
