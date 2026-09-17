"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Search, 
  CalendarDays, 
  Phone, 
  Wallet, 
  User, 
  Crown, 
  Sparkles, 
  MessageCircle, 
  ChevronRight, 
  X, 
  ArrowUpDown, 
  TrendingUp, 
  Users, 
  CalendarCheck,
  PhoneCall
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { format, parseISO } from "date-fns";
import { tr, enUS } from "date-fns/locale";

/**
 * Sorgudan dönen ham randevu satırı
 * (`select("id, customer_id, start_time, end_time, status, custom_fields, services(name, price)")`).
 * Supabase istemcisi tiplendirilmediği için `data` `any` gelir; bu arayüz
 * `any` kullanımını tek ve belgelenmiş bir noktaya indirir.
 */
interface RawCustomerAppointment {
  id: string;
  customer_id: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  custom_fields?: {
    customer_name?: string;
    phone?: string;
    note?: string;
  } | null;
  services?: { name?: string; price?: number } | null;
}

interface CustomerAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  service_name: string;
  price: number;
  note?: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  created_at?: string;
  appointment_count: number;
  completed_count: number;
  total_spent: number;
  last_appointment: string | null;
  segment: "vip" | "regular" | "new";
  appointments: CustomerAppointment[];
}

type SegmentFilter = "all" | "vip" | "regular" | "new";
type SortOption = "spent_desc" | "appts_desc" | "recent" | "name_asc";

export default function MusterilerPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const locale = lang === "tr" ? tr : enUS;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<SegmentFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("spent_desc");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      setLoading(false);
      return;
    }

    const [profilesRes, apptsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, created_at")
        .eq("tenant_id", profile.tenant_id)
        .order("full_name"),
      supabase
        .from("appointments")
        .select("id, customer_id, start_time, end_time, status, custom_fields, services(name, price)")
        .eq("tenant_id", profile.tenant_id)
        .order("start_time", { ascending: false }),
    ]);

    const profilesList = profilesRes.data || [];
    const apptsList =
      (apptsRes.data as unknown as RawCustomerAppointment[] | null) || [];

    // Harita oluştur
    const customerMap = new Map<string, Customer>();

    // 1. Kayıtlı profilleri ekle
    profilesList.forEach((p) => {
      customerMap.set(p.id, {
        id: p.id,
        full_name: p.full_name || (lang === "tr" ? "İsimsiz Müşteri" : "Unnamed Customer"),
        phone: p.phone || null,
        created_at: p.created_at,
        appointment_count: 0,
        completed_count: 0,
        total_spent: 0,
        last_appointment: null,
        segment: "new",
        appointments: [],
      });
    });

    // 2. Randevuları işle ve müşteri haritasına entegre et
    apptsList.forEach((a) => {
      const custId: string | null = a.customer_id;
      let cust = custId ? customerMap.get(custId) : undefined;

      // Profil kaydı yoksa custom_fields'tan türet
      if (!cust && custId) {
        cust = {
          id: custId,
          full_name: a.custom_fields?.customer_name || (lang === "tr" ? "Randevu Müşterisi" : "Booking Customer"),
          phone: a.custom_fields?.phone || null,
          appointment_count: 0,
          completed_count: 0,
          total_spent: 0,
          last_appointment: null,
          segment: "new",
          appointments: [],
        };
        customerMap.set(custId, cust);
      }

      // Kayıtsız (walk-in) müşteri: ad + telefon ile grupla
      if (!cust && !custId) {
        const walkName = a.custom_fields?.customer_name?.trim();
        const walkPhone = a.custom_fields?.phone?.trim() || "";
        if (walkName) {
          const walkKey = `walkin:${walkName.toLowerCase()}|${walkPhone}`;
          cust = customerMap.get(walkKey);
          if (!cust) {
            cust = {
              id: walkKey,
              full_name: walkName,
              phone: walkPhone || null,
              appointment_count: 0,
              completed_count: 0,
              total_spent: 0,
              last_appointment: null,
              segment: "new",
              appointments: [],
            };
            customerMap.set(walkKey, cust);
          }
        }
      }

      if (cust) {
        const isCancelled = a.status === "cancelled";
        const price = Number(a.services?.price) || 0;

        if (!isCancelled) {
          cust.appointment_count += 1;
          cust.total_spent += price;
          if (a.status === "completed") {
            cust.completed_count += 1;
          }
          if (!cust.last_appointment || new Date(a.start_time) > new Date(cust.last_appointment)) {
            cust.last_appointment = a.start_time;
          }
        }

        cust.appointments.push({
          id: a.id,
          start_time: a.start_time,
          // `end_time` DB'de nullable; eski kayıtlarda boş olabilir.
          end_time: a.end_time ?? a.start_time,
          status: a.status as CustomerAppointment["status"],
          service_name: a.services?.name || (lang === "tr" ? "Hizmet" : "Service"),
          price: price,
          note: a.custom_fields?.note || undefined,
        });
      }
    });

    // 3. Segment ve listeyi biçimlendir
    const processedCustomers = Array.from(customerMap.values())
      .filter((c) => c.appointment_count > 0 || c.appointments.length > 0)
      .map((c) => {
        let segment: "vip" | "regular" | "new" = "new";
        if (c.appointment_count >= 3) {
          segment = "vip";
        } else if (c.appointment_count === 2) {
          segment = "regular";
        }
        return {
          ...c,
          segment,
        };
      });

    setCustomers(processedCustomers);
    setLoading(false);
  };

  useEffect(() => {
    // Veri çekme bir dış sistem aboneliğidir; setState çağrıları await'ten
    // SONRA gerçekleşir, senkron kademeli render üretmez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
  }, [lang]);

  // WhatsApp link formatlayıcı
  const getWhatsAppUrl = (phone: string | null, name: string) => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "90" + digits.slice(1);
    if (!digits.startsWith("90") && digits.length === 10) digits = "90" + digits;
    const msg = encodeURIComponent(
      lang === "tr"
        ? `Merhaba ${name}, Randera üzerinden iletişime geçiyorum.`
        : `Hello ${name}, reaching out via Randera.`
    );
    return `https://wa.me/${digits}?text=${msg}`;
  };

  // İstatistikler (KPI)
  const metrics = useMemo(() => {
    const totalCount = customers.length;
    const vipCount = customers.filter((c) => c.segment === "vip").length;
    const regularCount = customers.filter((c) => c.segment === "regular").length;
    const newCount = customers.filter((c) => c.segment === "new").length;
    const totalRev = customers.reduce((sum, c) => sum + c.total_spent, 0);
    const avgLtv = totalCount > 0 ? Math.round(totalRev / totalCount) : 0;
    const loyaltyRatio = totalCount > 0 ? Math.round(((vipCount + regularCount) / totalCount) * 100) : 0;

    return {
      totalCount,
      vipCount,
      regularCount,
      newCount,
      totalRev,
      avgLtv,
      loyaltyRatio,
    };
  }, [customers]);

  // Filtreleme ve Sıralama
  const filteredAndSorted = useMemo(() => {
    return customers
      .filter((c) => {
        // Arama filtresi
        const matchesSearch =
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone && c.phone.includes(search));

        if (!matchesSearch) return false;

        // Segment filtresi
        if (activeSegment === "vip") return c.segment === "vip";
        if (activeSegment === "regular") return c.segment === "regular";
        if (activeSegment === "new") return c.segment === "new";

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "spent_desc") return b.total_spent - a.total_spent;
        if (sortBy === "appts_desc") return b.appointment_count - a.appointment_count;
        if (sortBy === "name_asc") return a.full_name.localeCompare(b.full_name);
        if (sortBy === "recent") {
          const aTime = a.last_appointment ? new Date(a.last_appointment).getTime() : 0;
          const bTime = b.last_appointment ? new Date(b.last_appointment).getTime() : 0;
          return bTime - aTime;
        }
        return 0;
      });
  }, [customers, search, activeSegment, sortBy]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            {lang === "tr" ? "Müşteri Portföyü & CRM" : "Customer CRM & Portfolio"}
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800/60">
              {customers.length} {lang === "tr" ? "Kayıt" : "Records"}
            </span>
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
            {lang === "tr" 
              ? "Müşterilerinizin randevu geçmişini, sadakat düzeylerini ve toplam harcamalarını tek ekranda yönetin."
              : "Track customer appointment history, loyalty levels, and lifetime spending."}
          </p>
        </div>
      </div>

      {/* 2. KPI Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Toplam Müşteri */}
        <div className="p-4 md:p-5 rounded-2xl md:rounded-[24px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-slate-800/70 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-semibold text-gray-500 dark:text-slate-400">
              {lang === "tr" ? "Toplam Müşteri" : "Total Customers"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
              {metrics.totalCount}
            </div>
            <div className="text-[11px] md:text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp size={13} />
              {metrics.loyaltyRatio}% {lang === "tr" ? "Tekrar Eden Ziyaret" : "Retention Rate"}
            </div>
          </div>
        </div>

        {/* Sadık / VIP Müşteriler */}
        <div className="p-4 md:p-5 rounded-2xl md:rounded-[24px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-slate-800/70 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-semibold text-gray-500 dark:text-slate-400">
              {lang === "tr" ? "Sadık Müşteriler" : "VIP & Regulars"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Crown size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400">
              {metrics.vipCount + metrics.regularCount}
            </div>
            <div className="text-[11px] md:text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">
              {metrics.vipCount} VIP (≥3) • {metrics.regularCount} {lang === "tr" ? "Düzenli" : "Regular"}
            </div>
          </div>
        </div>

        {/* Toplam Hasılat */}
        <div className="p-4 md:p-5 rounded-2xl md:rounded-[24px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-slate-800/70 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-semibold text-gray-500 dark:text-slate-400">
              {lang === "tr" ? "Toplam Ciro" : "Total Revenue"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              ₺{metrics.totalRev.toLocaleString("tr-TR")}
            </div>
            <div className="text-[11px] md:text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">
              {lang === "tr" ? "Kayıtlı randevu cirosu" : "From recorded bookings"}
            </div>
          </div>
        </div>

        {/* Ortalama LTV */}
        <div className="p-4 md:p-5 rounded-2xl md:rounded-[24px] bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-slate-800/70 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-semibold text-gray-500 dark:text-slate-400">
              {lang === "tr" ? "Ort. Müşteri Değeri" : "Avg. Customer LTV"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
              ₺{metrics.avgLtv.toLocaleString("tr-TR")}
            </div>
            <div className="text-[11px] md:text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">
              {lang === "tr" ? "Kişi başı ortalama" : "Average per customer"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "tr"
                ? "İsim veya telefon numarası ile ara..."
                : "Search by name or phone..."
            }
            className="w-full rounded-2xl border-0 bg-white/70 py-3.5 pl-11 pr-10 text-sm md:text-base text-gray-900 placeholder-gray-400 shadow-[0_4px_20px_rgb(0,0,0,0.03)] backdrop-blur-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder-slate-500 transition-all border border-white/60 dark:border-slate-800/70"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Segment Tabs & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-slate-800/70 shadow-sm text-xs font-bold">
            <button
              onClick={() => setActiveSegment("all")}
              className={`px-3 py-2 rounded-xl transition-all ${
                activeSegment === "all"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {lang === "tr" ? "Tümü" : "All"} ({customers.length})
            </button>
            <button
              onClick={() => setActiveSegment("vip")}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1 ${
                activeSegment === "vip"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "text-gray-600 dark:text-slate-400 hover:text-amber-500"
              }`}
            >
              <Crown size={13} />
              VIP ({metrics.vipCount})
            </button>
            <button
              onClick={() => setActiveSegment("regular")}
              className={`px-3 py-2 rounded-xl transition-all ${
                activeSegment === "regular"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-gray-600 dark:text-slate-400 hover:text-blue-500"
              }`}
            >
              {lang === "tr" ? "Düzenli" : "Regular"} ({metrics.regularCount})
            </button>
            <button
              onClick={() => setActiveSegment("new")}
              className={`px-3 py-2 rounded-xl transition-all ${
                activeSegment === "new"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-600 dark:text-slate-400 hover:text-emerald-500"
              }`}
            >
              {lang === "tr" ? "Yeni" : "New"} ({metrics.newCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none rounded-2xl bg-white/70 py-3 pl-4 pr-9 text-xs font-bold text-gray-700 shadow-sm backdrop-blur-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-slate-900/60 dark:text-slate-300 border border-white/60 dark:border-slate-800/70 cursor-pointer"
            >
              <option value="spent_desc">{lang === "tr" ? "En Yüksek Ciro" : "Highest Spent"}</option>
              <option value="appts_desc">{lang === "tr" ? "En Çok Randevu" : "Most Visits"}</option>
              <option value="recent">{lang === "tr" ? "En Son Randevu" : "Most Recent"}</option>
              <option value="name_asc">{lang === "tr" ? "İsim (A-Z)" : "Name (A-Z)"}</option>
            </select>
            <ArrowUpDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* 4. Customer List */}
      <div className="overflow-hidden rounded-[28px] md:rounded-[32px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-slate-800/70">
        {loading ? (
          <div className="py-20 text-center text-sm font-medium text-gray-500 dark:text-slate-400 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            {lang === "tr" ? "Müşteri kayıtları yükleniyor..." : "Loading customers..."}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-800 mb-4 text-gray-400">
              <User size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {search
                ? lang === "tr"
                  ? "Aradığınız kriterlere uygun müşteri bulunamadı."
                  : "No customers match your search."
                : lang === "tr"
                  ? "Henüz müşteri kaydınız bulunmuyor."
                  : "No customers in your portfolio yet."}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
              {search
                ? lang === "tr"
                  ? "Arama kelimesini değiştirmeyi veya filtreleri temizlemeyi deneyin."
                  : "Try clearing your search or switching filter categories."
                : lang === "tr"
                  ? "Müşterileriniz web sayfanızdan veya paylaştığınız randevu linkinden rezervasyon yaptıkça burada listelenir."
                  : "Customers will appear here once they book appointments via your booking page."}
            </p>
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setActiveSegment("all");
                }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
              >
                {lang === "tr" ? "Filtreleri Temizle" : "Reset Filters"}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800/80">
            {filteredAndSorted.map((customer) => {
              const waUrl = getWhatsAppUrl(customer.phone, customer.full_name);

              return (
                <div
                  key={customer.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 gap-4 hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Sol: Avatar + İsim + İletişim */}
                  <div
                    onClick={() => setSelectedCustomer(customer)}
                    className="flex items-center gap-3.5 md:gap-4 cursor-pointer min-w-0 flex-1"
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/50 dark:border-indigo-500/20 text-base md:text-lg font-black text-indigo-600 dark:text-indigo-400 shadow-sm group-hover:scale-105 transition-transform">
                        {customer.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "M"}
                      </div>
                      {customer.segment === "vip" && (
                        <div className="absolute -top-1 -right-1 p-1 rounded-full bg-amber-500 text-white shadow-md">
                          <Crown size={11} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base md:text-[17px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {customer.full_name}
                        </h3>

                        {/* Segment Badge */}
                        {customer.segment === "vip" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                            <Crown size={10} />
                            VIP / Sadık
                          </span>
                        ) : customer.segment === "regular" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                            Düzenli
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                            Yeni
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400 flex-wrap">
                        {customer.phone ? (
                          <span className="flex items-center gap-1 font-medium text-gray-600 dark:text-slate-300">
                            <Phone size={12} className="text-indigo-500" />
                            {customer.phone}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">
                            {lang === "tr" ? "Telefon kayıtlı değil" : "No phone saved"}
                          </span>
                        )}

                        {customer.last_appointment && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500">
                            • {lang === "tr" ? "Son Randevu:" : "Last Visit:"}{" "}
                            {format(parseISO(customer.last_appointment), "d MMM yyyy", { locale })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sağ: İstatistikler ve Hızlı Aksiyon Butonları */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800">
                    {/* Tutarlar */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 text-right">
                      <div className="inline-flex items-center gap-1 text-xs md:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                        <Wallet size={13} />
                        ₺{customer.total_spent.toLocaleString("tr-TR")}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-slate-400">
                        <CalendarDays size={12} />
                        {customer.appointment_count}{" "}
                        {lang === "tr" ? "randevu" : "visits"}
                      </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex items-center gap-1.5">
                      {/* WhatsApp Button */}
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={lang === "tr" ? "WhatsApp'tan Mesaj At" : "Message on WhatsApp"}
                          className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white transition-all active:scale-95"
                        >
                          <MessageCircle size={16} />
                        </a>
                      ) : (
                        <button
                          disabled
                          className="p-2.5 rounded-xl bg-gray-100 text-gray-300 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                        >
                          <MessageCircle size={16} />
                        </button>
                      )}

                      {/* Telefon Ara Button */}
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          title={lang === "tr" ? "Telefonla Ara" : "Call Customer"}
                          className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-all active:scale-95"
                        >
                          <PhoneCall size={16} />
                        </a>
                      ) : (
                        <button
                          disabled
                          className="p-2.5 rounded-xl bg-gray-100 text-gray-300 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                        >
                          <PhoneCall size={16} />
                        </button>
                      )}

                      {/* Detay Aç Butonu */}
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="p-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-600 dark:hover:text-white transition-all active:scale-95"
                        title={lang === "tr" ? "Müşteri Geçmişi & Detayı" : "Customer Details"}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Customer Detail Slideover / Modal */}
      {selectedCustomer && (
        <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end bg-black/40 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-white/60 dark:border-slate-800 overflow-hidden animate-in slide-in-from-right-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-black text-xl border border-indigo-100 dark:border-indigo-800">
                  {selectedCustomer.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "M"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedCustomer.full_name}
                    </h2>
                    {selectedCustomer.segment === "vip" && (
                      <span className="p-1 rounded-full bg-amber-500 text-white shadow-sm">
                        <Crown size={12} />
                      </span>
                    )}
                  </div>
                  {selectedCustomer.phone && (
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Phone size={13} className="text-indigo-500" />
                      {selectedCustomer.phone}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Mini Stats Banner */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/50">
                <div className="text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    {lang === "tr" ? "Randevu" : "Visits"}
                  </span>
                  <span className="text-xl font-black text-gray-900 dark:text-white mt-0.5 block">
                    {selectedCustomer.appointment_count}
                  </span>
                </div>
                <div className="text-center border-x border-gray-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    {lang === "tr" ? "Toplam Ciro" : "Total Spent"}
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    ₺{selectedCustomer.total_spent.toLocaleString("tr-TR")}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    {lang === "tr" ? "Ortalama" : "Average"}
                  </span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                    ₺
                    {Math.round(
                      selectedCustomer.total_spent / (selectedCustomer.appointment_count || 1)
                    ).toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>

              {/* Randevu Geçmişi Listesi */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3 flex items-center justify-between">
                  <span>{lang === "tr" ? "Randevu Geçmişi" : "Appointment History"}</span>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedCustomer.appointments.length} {lang === "tr" ? "Kayıt" : "Records"}
                  </span>
                </h4>

                {selectedCustomer.appointments.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-slate-400 rounded-2xl bg-gray-50 dark:bg-slate-800/40">
                    {lang === "tr" ? "Henüz randevu geçmişi yok." : "No appointment history found."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCustomer.appointments.map((appt) => {
                      const isCompleted = appt.status === "completed";
                      const isCancelled = appt.status === "cancelled";
                      const isConfirmed = appt.status === "confirmed";

                      return (
                        <div
                          key={appt.id}
                          className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              {appt.service_name}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                isCancelled
                                  ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                                  : isCompleted
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                  : isConfirmed
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                              }`}
                            >
                              {isCancelled
                                ? lang === "tr"
                                  ? "İptal Edildi"
                                  : "Cancelled"
                                : isCompleted
                                ? lang === "tr"
                                  ? "Tamamlandı"
                                  : "Completed"
                                : isConfirmed
                                ? lang === "tr"
                                  ? "Onaylandı"
                                  : "Confirmed"
                                : lang === "tr"
                                ? "Bekliyor"
                                : "Pending"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-medium">
                              <CalendarCheck size={13} className="text-gray-400" />
                              {format(parseISO(appt.start_time), "d MMMM yyyy, HH:mm", { locale })}
                            </span>
                            <span className="font-black text-gray-800 dark:text-slate-200">
                              ₺{appt.price.toLocaleString("tr-TR")}
                            </span>
                          </div>

                          {appt.note && (
                            <div className="text-[11px] text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800/80 italic">
                              &ldquo;{appt.note}&rdquo;
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 md:p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center gap-3">
              {getWhatsAppUrl(selectedCustomer.phone, selectedCustomer.full_name) && (
                <a
                  href={getWhatsAppUrl(selectedCustomer.phone, selectedCustomer.full_name)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-98"
                >
                  <MessageCircle size={16} />
                  {lang === "tr" ? "WhatsApp Mesajı" : "WhatsApp Message"}
                </a>
              )}

              {selectedCustomer.phone && (
                <a
                  href={`tel:${selectedCustomer.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all active:scale-98"
                >
                  <PhoneCall size={16} />
                  {lang === "tr" ? "Telefonla Ara" : "Call Customer"}
                </a>
              )}

              <button
                onClick={() => setSelectedCustomer(null)}
                className="py-3 px-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold text-xs transition-colors"
              >
                {lang === "tr" ? "Kapat" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

