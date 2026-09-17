"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  DollarSign,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Plus,
  ArrowRight,
  Phone,
  MessageSquare,
  Calendar,
  X,
  AlertCircle,
  Bell,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import type { DashboardStats, Service, Profile } from "@/types";
import { PageSkeleton } from "@/components/Skeleton";
import CustomSelect from "@/components/CustomSelect";

interface TodayAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customer_name: string;
  customer_phone: string;
  service_name: string;
  service_price: number;
  service_duration: number;
  note?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    dailyRevenue: 0,
    pendingAppointments: 0,
    newCustomers: 0,
    nextAppointment: null,
  });
  const [completedRevenue, setCompletedRevenue] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<
    TodayAppointment[]
  >([]);
  const [pendingApprovalAppts, setPendingApprovalAppts] = useState<
    TodayAppointment[]
  >([]);
  const [tenant, setTenant] = useState<{
    id: string;
    name: string;
    slug: string;
    sector?: string;
  } | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI States
  const [copied, setCopied] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New appointment form state
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentNote, setAppointmentNote] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const supabase = createClient();
  const { t, lang } = useLanguage();

  const fetchDashboardData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!profile?.tenant_id) return;
    const tId = profile.tenant_id;

    // Fetch tenant details
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("id, name, slug, sector")
      .eq("id", tId)
      .single();

    if (tenantData) {
      setTenant(tenantData);
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch today's appointments with service & profile info
    const [
      todayApptsRes,
      pendingCountRes,
      newCustRes,
      nextApptRes,
      servicesRes,
      customersRes,
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "*, services(name, price, duration, duration_minutes), profiles!appointments_customer_id_fkey(full_name, phone)",
        )
        .eq("tenant_id", tId)
        .neq("status", "cancelled")
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString())
        .order("start_time", { ascending: true }),

      supabase
        .from("appointments")
        .select(
          "*, services(name, price, duration, duration_minutes), profiles!appointments_customer_id_fkey(full_name, phone)",
        )
        .eq("tenant_id", tId)
        .neq("status", "cancelled")
        .eq("status", "pending")
        .order("start_time", { ascending: true }),

      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tId)
        .eq("role", "customer")
        .gte("created_at", thirtyDaysAgo.toISOString()),

      supabase
        .from("appointments")
        .select(
          "*, services(name), profiles!appointments_customer_id_fkey(full_name)",
        )
        .eq("tenant_id", tId)
        .eq("status", "confirmed")
        .gte("start_time", now.toISOString())
        .order("start_time", { ascending: true })
        .limit(1),

      supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tId)
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("profiles")
        .select("*")
        .eq("tenant_id", tId)
        .eq("role", "customer")
        .order("full_name"),
    ]);

    const rawTodayAppts = todayApptsRes.data || [];
    const dailyRev = rawTodayAppts.reduce(
      (sum, app) => sum + (app.services?.price || 0),
      0,
    );
    const compRev = rawTodayAppts
      .filter((app) => app.status === "completed")
      .reduce((sum, app) => sum + (app.services?.price || 0), 0);

    const formattedToday: TodayAppointment[] = rawTodayAppts.map((app) => {
      const name =
        app.profiles?.full_name ||
        app.custom_fields?.customer_name ||
        (lang === "tr" ? "İsimsiz Müşteri" : "Guest Customer");
      const phone = app.profiles?.phone || app.custom_fields?.phone || "";
      return {
        id: app.id,
        start_time: app.start_time,
        end_time: app.end_time,
        status: app.status as TodayAppointment["status"],
        customer_name: name,
        customer_phone: phone,
        service_name:
          app.services?.name || (lang === "tr" ? "Hizmet" : "Service"),
        service_price: app.services?.price || 0,
        service_duration:
          (app.services as any)?.duration ||
          app.services?.duration_minutes ||
          30,
        note: app.custom_fields?.note || "",
      };
    });

    const rawPendingAppts = (pendingCountRes.data as any[]) || [];
    const formattedPending: TodayAppointment[] = rawPendingAppts.map((app) => {
      const name =
        app.profiles?.full_name ||
        app.custom_fields?.customer_name ||
        (lang === "tr" ? "İsimsiz Müşteri" : "Guest Customer");
      const phone = app.profiles?.phone || app.custom_fields?.phone || "";
      return {
        id: app.id,
        start_time: app.start_time,
        end_time: app.end_time,
        status: "pending",
        customer_name: name,
        customer_phone: phone,
        service_name:
          app.services?.name || (lang === "tr" ? "Hizmet" : "Service"),
        service_price: app.services?.price || 0,
        service_duration:
          (app.services as any)?.duration ||
          app.services?.duration_minutes ||
          30,
        note: app.custom_fields?.note || "",
      };
    });

    const nextAppt = nextApptRes.data?.[0] || null;
    if (nextAppt) {
      nextAppt.customer_name =
        nextAppt.profiles?.full_name ||
        nextAppt.custom_fields?.customer_name ||
        (lang === "tr" ? "Müşteri" : "Customer");
    }

    setStats({
      dailyRevenue: dailyRev,
      pendingAppointments: formattedPending.length,
      newCustomers: newCustRes.count || 0,
      nextAppointment: nextAppt,
    });
    setCompletedRevenue(compRev);
    setTodayAppointments(formattedToday);
    setPendingApprovalAppts(formattedPending);
    setServices((servicesRes.data as Service[]) || []);
    setCustomers((customersRes.data as Profile[]) || []);
    setLoading(false);
  }, [supabase, lang]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Set default appointment date & time when opening modal
  useEffect(() => {
    if (showAddModal) {
      const d = new Date();
      const dateStr = d.toISOString().split("T")[0];
      d.setHours(d.getHours() + 1, 0, 0, 0);
      const timeStr = `${d.getHours().toString().padStart(2, "0")}:00`;
      setAppointmentDate(dateStr);
      setAppointmentTime(timeStr);
      if (services.length > 0 && !selectedServiceId) {
        setSelectedServiceId(services[0].id);
      }
      setFormError("");
    }
  }, [showAddModal, services, selectedServiceId]);

  const bookingUrl =
    typeof window !== "undefined" && tenant?.slug
      ? `${window.location.origin}/b/${tenant.slug}`
      : "";

  const handleCopyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleMarkCompleted = async (id: string) => {
    setActionLoadingId(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", id);

    if (!error) {
      setTodayAppointments((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, status: "completed" } : app,
        ),
      );
      // Update completed revenue locally
      const completedApp = todayAppointments.find((a) => a.id === id);
      if (completedApp) {
        setCompletedRevenue((c) => c + completedApp.service_price);
      }
    }
    setActionLoadingId(null);
  };

  const handleApproveAppointment = async (id: string) => {
    setActionLoadingId(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", id);

    if (!error) {
      setPendingApprovalAppts((prev) => prev.filter((a) => a.id !== id));
      setTodayAppointments((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, status: "confirmed" } : app,
        ),
      );
      setStats((prev) => ({
        ...prev,
        pendingAppointments: Math.max(0, prev.pendingAppointments - 1),
      }));
    }
    setActionLoadingId(null);
  };

  const handleRejectAppointment = async (id: string) => {
    if (
      !confirm(
        lang === "tr"
          ? "Bu randevu talebini reddetmek istediğinize emin misiniz?"
          : "Are you sure you want to decline this appointment request?",
      )
    ) {
      return;
    }
    setActionLoadingId(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (!error) {
      setPendingApprovalAppts((prev) => prev.filter((a) => a.id !== id));
      setTodayAppointments((prev) => prev.filter((a) => a.id !== id));
      setStats((prev) => ({
        ...prev,
        pendingAppointments: Math.max(0, prev.pendingAppointments - 1),
      }));
    }
    setActionLoadingId(null);
  };

  const handleQuickAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    if (!selectedServiceId) {
      setFormError(
        lang === "tr" ? "Lütfen bir hizmet seçin." : "Please select a service.",
      );
      return;
    }

    let customerId = selectedCustomerId;
    let customerName = newCustomerName.trim();
    let customerPhone = newCustomerPhone.trim();

    if (customerMode === "existing") {
      const existing = customers.find((c) => c.id === selectedCustomerId);
      if (!existing) {
        setFormError(
          lang === "tr" ? "Lütfen müşteri seçin." : "Please select a customer.",
        );
        return;
      }
      customerName = existing.full_name || "";
      customerPhone = existing.phone || "";
    } else {
      if (!customerName) {
        setFormError(
          lang === "tr"
            ? "Lütfen müşteri adını girin."
            : "Please enter customer name.",
        );
        return;
      }
      try {
        const { data: newProf, error: profErr } = await supabase
          .from("profiles")
          .insert({
            tenant_id: tenant.id,
            full_name: customerName,
            phone: customerPhone || null,
            role: "customer",
          })
          .select("id")
          .single();

        if (!profErr && newProf) {
          customerId = newProf.id;
        }
      } catch {
        // Fallback: continue
      }
    }

    const selectedService = services.find((s) => s.id === selectedServiceId);
    const duration =
      (selectedService as any)?.duration ||
      selectedService?.duration_minutes ||
      30;

    const [hours, minutes] = appointmentTime.split(":").map(Number);
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const start = new Date(year, month - 1, day, hours, minutes);
    const end = new Date(start.getTime() + duration * 60000);

    setFormSubmitting(true);
    setFormError("");

    const insertPayload: Record<string, unknown> = {
      tenant_id: tenant.id,
      service_id: selectedServiceId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "confirmed",
      custom_fields: {
        customer_name: customerName,
        phone: customerPhone,
        note: appointmentNote,
      },
    };

    if (customerId) {
      insertPayload.customer_id = customerId;
    }

    // Randevu, hizmeti veren elemanın takvimine düşsün (müsaitlik hesabı için)
    insertPayload.staff_id =
      (selectedService as { staff_id?: string | null } | undefined)?.staff_id ??
      null;

    const { error: insertError } = await supabase
      .from("appointments")
      .insert(insertPayload);

    setFormSubmitting(false);

    if (insertError) {
      setFormError(insertError.message);
      return;
    }

    setShowAddModal(false);
    setSelectedCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setAppointmentNote("");
    fetchDashboardData();
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const locale = lang === "tr" ? "tr-TR" : "en-US";
    const sStr = s.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const eStr = e.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${sStr} - ${eStr}`;
  };

  const getTimeLeft = (isoString: string) => {
    const diff = Math.max(
      0,
      new Date(isoString).getTime() - new Date().getTime(),
    );
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor(((diff % 86400000) % 3600000) / 60000);

    if (days > 0) {
      return lang === "tr" ? `${days} gün ${hours} sa` : `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return lang === "tr"
        ? `${hours} sa ${minutes} dk`
        : `${hours}h ${minutes}m`;
    }
    return lang === "tr" ? `${minutes} dk` : `${minutes}m`;
  };

  // Occupancy rate calculation (e.g. today's appointments out of target 8)
  const completedCount = todayAppointments.filter(
    (a) => a.status === "completed",
  ).length;
  const totalTodayCount = todayAppointments.length;
  const occupancyPercentage = Math.min(
    100,
    Math.round((totalTodayCount / 8) * 100),
  );

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* 1. TOP HEADER & QUICK ACTIONS BAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {t("nav.overview")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {tenant?.name || "Randera"} •{" "}
            {new Date().toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            ,{" "}
            {new Date().toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
              weekday: "long",
            })}
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Copy Booking Link Button */}
          {tenant?.slug && (
            <div className="inline-flex items-center rounded-2xl bg-white/70 dark:bg-slate-800/70 p-1 border border-gray-200/70 dark:border-slate-700/60 shadow-sm backdrop-blur-xl">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 transition-all active:scale-95"
                title={bookingUrl}
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {t("dashboard.link_copied")}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy
                      size={16}
                      className="text-indigo-600 dark:text-indigo-400"
                    />
                    <span>{t("dashboard.copy_link")}</span>
                  </>
                )}
              </button>

              <a
                href={`/b/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title={t("dashboard.view_page")}
              >
                <ExternalLink size={15} />
              </a>
            </div>
          )}

          {/* Quick Add Appointment Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{t("dashboard.new_appointment")}</span>
          </button>

          {/* Link to Calendar */}
          <Link
            href="/dashboard/takvim"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/60 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 transition-all active:scale-95"
          >
            <Calendar size={17} />
            <span>{t("nav.calendar")}</span>
          </Link>
        </div>
      </div>

      {/* 2. STATS & KEY METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
        {/* Widget 1: Revenue */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/50 bg-gradient-to-br from-white/90 via-white/70 to-white/40 p-3.5 sm:p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-900/40 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 truncate">
              {t("dashboard.occupancy")} (₺)
            </span>
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 shrink-0">
              <DollarSign size={17} className="sm:w-[22px] sm:h-[22px]" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white truncate">
              ₺
              {stats.dailyRevenue.toLocaleString(
                lang === "tr" ? "tr-TR" : "en-US",
              )}
            </p>
            <div className="mt-1 sm:mt-2 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">
                ₺
                {completedRevenue.toLocaleString(
                  lang === "tr" ? "tr-TR" : "en-US",
                )}{" "}
                {t("dashboard.status.completed").toLowerCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Widget 2: Today's Appointments */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/50 bg-gradient-to-br from-white/90 via-white/70 to-white/40 p-3.5 sm:p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-900/40 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 truncate">
              {t("dashboard.today_appointments")}
            </span>
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shrink-0">
              <CalendarDays size={17} className="sm:w-[22px] sm:h-[22px]" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              {totalTodayCount}
            </p>
            <div className="mt-1 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-400 truncate">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {completedCount}
              </span>{" "}
              {t("dashboard.status.completed").toLowerCase()}
              <span>•</span>
              <span className="text-amber-500 font-bold">
                {totalTodayCount - completedCount}
              </span>{" "}
              {t("dashboard.pending").toLowerCase()}
            </div>
          </div>
        </div>

        {/* Widget 3: Occupancy Progress Bar */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/50 bg-gradient-to-br from-white/90 via-white/70 to-white/40 p-3.5 sm:p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-900/40 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 truncate">
              {t("dashboard.occupancy_rate")}
            </span>
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shrink-0">
              <CheckCircle2 size={17} className="sm:w-[22px] sm:h-[22px]" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                %{occupancyPercentage}
              </p>
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
                {totalTodayCount}/8
              </span>
            </div>
            <div className="mt-2 sm:mt-3 w-full bg-gray-100 dark:bg-slate-700/60 rounded-full h-1.5 sm:h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Widget 4: New Customers */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/50 bg-gradient-to-br from-white/90 via-white/70 to-white/40 p-3.5 sm:p-6 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-900/40 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 truncate">
              {t("dashboard.new_customer")}
            </span>
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 shrink-0">
              <Users size={17} className="sm:w-[22px] sm:h-[22px]" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              {stats.newCustomers}
            </p>
            <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-gray-400 dark:text-slate-400 truncate">
              {lang === "tr" ? "Son 30 günde" : "Last 30 days"}
            </p>
          </div>
        </div>
      </div>

      {/* 2.5. PENDING APPROVALS ALERT SECTION */}
      {pendingApprovalAppts.length > 0 && (
        <div className="rounded-[32px] border border-amber-300/80 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white/90 p-6 backdrop-blur-3xl dark:border-amber-500/30 dark:from-amber-950/40 dark:via-slate-900/60 dark:to-slate-900/40 shadow-lg shadow-amber-500/5 space-y-4 animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  {lang === "tr"
                    ? "Onay Bekleyen Randevular"
                    : "Pending Approval Requests"}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white shadow-xs">
                    {pendingApprovalAppts.length}
                  </span>
                </h2>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  {lang === "tr"
                    ? "Müşterilerinizden gelen randevu taleplerini inceleyip onaylayabilir veya reddedebilirsiniz."
                    : "Review, approve, or decline new appointment requests from customers."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {pendingApprovalAppts.map((app) => {
              const cleanPhone = app.customer_phone.replace(/\D/g, "");
              const formattedTime = new Date(app.start_time).toLocaleDateString(
                lang === "tr" ? "tr-TR" : "en-US",
                {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );

              return (
                <div
                  key={app.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-amber-200/70 dark:border-slate-700/80 shadow-xs"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-lg shadow-sm">
                      {app.customer_name
                        ? app.customer_name.charAt(0).toUpperCase()
                        : "M"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">
                          {app.customer_name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                          {lang === "tr" ? "Onay Bekliyor" : "Pending"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-1 flex-wrap">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {formattedTime}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-gray-800 dark:text-slate-200">
                          {app.service_name}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          ₺{app.service_price}
                        </span>
                        {app.customer_phone && (
                          <>
                            <span>•</span>
                            <span className="text-gray-600 dark:text-slate-300 font-medium">
                              {app.customer_phone}
                            </span>
                          </>
                        )}
                      </div>

                      {app.note && (
                        <p className="text-xs text-gray-600 dark:text-slate-300 italic mt-1 bg-amber-50/60 dark:bg-slate-900/50 p-2 rounded-xl border border-amber-100 dark:border-slate-800">
                          &ldquo;{app.note}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone.startsWith("90") ? cleanPhone : `90${cleanPhone}`}?text=${encodeURIComponent(
                          lang === "tr"
                            ? `Merhaba ${app.customer_name}, Randera üzerinden oluşturduğunuz randevu talebiniz hakkında iletişime geçiyorum.`
                            : `Hello ${app.customer_name}, contacting you regarding your booking request on Randera.`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
                        title="WhatsApp"
                      >
                        <MessageSquare size={16} />
                      </a>
                    )}

                    <button
                      onClick={() => handleRejectAppointment(app.id)}
                      disabled={actionLoadingId === app.id}
                      className="px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {lang === "tr" ? "Reddet" : "Decline"}
                    </button>

                    <button
                      onClick={() => handleApproveAppointment(app.id)}
                      disabled={actionLoadingId === app.id}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Check size={15} strokeWidth={3} />
                      <span>
                        {lang === "tr" ? "Randevuyu Onayla" : "Approve Booking"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. NEXT APPOINTMENT SPOTLIGHT */}
      {stats.nextAppointment && (
        <div className="relative overflow-hidden rounded-[30px] border border-amber-200/60 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white/80 p-5 sm:p-6 backdrop-blur-2xl dark:border-amber-500/20 dark:from-amber-950/30 dark:via-slate-900/60 dark:to-slate-900/40 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
                <Clock size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {t("dashboard.recent_appointments")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200/60 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    {getTimeLeft(stats.nextAppointment.start_time)}{" "}
                    {lang === "tr" ? "kaldı" : "left"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {stats.nextAppointment.customer_name}
                  <span className="text-sm font-normal text-gray-500 dark:text-slate-400 ml-2">
                    •{" "}
                    {stats.nextAppointment.services?.name ||
                      t("dashboard.service")}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right mr-2 hidden sm:block">
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {new Date(
                    stats.nextAppointment.start_time,
                  ).toLocaleTimeString(lang === "tr" ? "tr-TR" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Link
                href="/dashboard/takvim"
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/20 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <span>{t("nav.calendar")}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. TODAY'S LIVE APPOINTMENTS TIMELINE */}
      <div className="rounded-[32px] border border-white/60 bg-white/70 backdrop-blur-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-slate-700/50 dark:bg-slate-900/70">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("dashboard.today_flow")}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {todayAppointments.length}{" "}
              {lang === "tr" ? "randevu planlandı" : "appointments scheduled"}
            </p>
          </div>
        </div>

        {todayAppointments.length === 0 ? (
          /* Empty state */
          <div className="py-14 text-center border-2 border-dashed border-gray-200/80 dark:border-slate-800 rounded-3xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 mb-3">
              <Calendar size={26} />
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-slate-200">
              {t("dashboard.no_today_appointments")}
            </h4>
            <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto mt-1">
              {lang === "tr"
                ? "Günün randevuları burada saat sırasına göre listelenir."
                : "Today's scheduled appointments will appear here in chronological order."}
            </p>
          </div>
        ) : (
          /* Timeline items */
          <div className="space-y-3">
            {todayAppointments.map((app) => {
              const isCompleted = app.status === "completed";
              const cleanPhone = app.customer_phone.replace(/\D/g, "");
              const initial = app.customer_name
                ? app.customer_name.charAt(0).toUpperCase()
                : "M";

              return (
                <div
                  key={app.id}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                    isCompleted
                      ? "bg-slate-50/60 dark:bg-slate-800/30 border-gray-100 dark:border-slate-800/60 opacity-80"
                      : "bg-white/80 dark:bg-slate-800/80 border-gray-200/60 dark:border-slate-700/60 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Time Pill */}
                    <div
                      className={`flex flex-col items-center justify-center w-24 sm:w-28 py-2 rounded-xl text-center font-bold shrink-0 ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                      }`}
                    >
                      <span className="text-xs sm:text-sm">
                        {formatTimeRange(app.start_time, app.end_time)}
                      </span>
                      <span className="text-[10px] font-medium opacity-75">
                        {app.service_duration} {lang === "tr" ? "dk" : "min"}
                      </span>
                    </div>

                    {/* Customer Initials & Details */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm shadow-sm">
                        {initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                            {app.customer_name}
                          </p>
                          {isCompleted ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              {t("dashboard.status.completed")}
                            </span>
                          ) : app.status === "pending" ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                              {lang === "tr"
                                ? "Onay Bekliyor"
                                : "Pending Approval"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                              {t("dashboard.status.confirmed")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          <span className="font-medium text-gray-700 dark:text-slate-300">
                            {app.service_name}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ₺{app.service_price}
                          </span>
                          {app.note && (
                            <>
                              <span>•</span>
                              <span className="italic truncate max-w-[150px] sm:max-w-[200px]">
                                &quot;{app.note}&quot;
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Contact & Completion Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {cleanPhone && (
                      <>
                        <a
                          href={`https://wa.me/${cleanPhone.startsWith("90") ? cleanPhone : `90${cleanPhone}`}?text=${encodeURIComponent(
                            lang === "tr"
                              ? `Merhaba ${app.customer_name}, Randera üzerinden saat ${new Date(app.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} randevunuz hakkında iletişime geçiyorum.`
                              : `Hello ${app.customer_name}, contacting you regarding your appointment at ${new Date(app.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}.`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 text-xs font-semibold transition-colors"
                          title={t("dashboard.whatsapp")}
                        >
                          <MessageSquare size={14} />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>

                        <a
                          href={`tel:${cleanPhone}`}
                          className="p-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
                          title={t("dashboard.call")}
                        >
                          <Phone size={14} />
                        </a>
                      </>
                    )}

                    {!isCompleted && app.status === "pending" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRejectAppointment(app.id)}
                          disabled={actionLoadingId === app.id}
                          className="px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {lang === "tr" ? "Reddet" : "Reject"}
                        </button>
                        <button
                          onClick={() => handleApproveAppointment(app.id)}
                          disabled={actionLoadingId === app.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Check size={14} strokeWidth={3} />
                          <span>{lang === "tr" ? "Onayla" : "Approve"}</span>
                        </button>
                      </div>
                    )}

                    {!isCompleted && app.status === "confirmed" && (
                      <button
                        onClick={() => handleMarkCompleted(app.id)}
                        disabled={actionLoadingId === app.id}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Check size={14} strokeWidth={3} />
                        <span>{t("dashboard.mark_completed")}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUICK ADD APPOINTMENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-backdrop-in">
          <div className="relative w-full max-w-lg rounded-[32px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-2xl animate-modal-in">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Plus size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t("dashboard.new_appointment")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {lang === "tr"
                    ? "Hızlıca randevu oluşturun ve takviminize işleyin."
                    : "Quickly book an appointment into your schedule."}
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300 text-xs font-medium">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleQuickAddAppointment} className="space-y-4">
              {/* Service Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {t("dashboard.service")}
                </label>
                <CustomSelect
                  value={selectedServiceId}
                  onChange={(val) => setSelectedServiceId(val)}
                  options={services.map((s) => {
                    const dur = (s as any).duration || s.duration_minutes || 30;
                    return {
                      value: s.id,
                      label: s.name,
                      badge: `₺${s.price}`,
                      sublabel: `${dur} ${lang === "tr" ? "dk" : "min"}`,
                    };
                  })}
                  placeholder={
                    lang === "tr" ? "Hizmet seçin..." : "Select service..."
                  }
                  searchable={true}
                  searchPlaceholder={
                    lang === "tr"
                      ? "Hizmet ara (örn: Saç Tasarım)..."
                      : "Search service..."
                  }
                />
              </div>

              {/* Customer Mode Switch */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                    {t("dashboard.customer")}
                  </label>
                  <div className="flex rounded-lg bg-gray-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setCustomerMode("new")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        customerMode === "new"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                          : "text-gray-500 hover:text-gray-800 dark:text-slate-400"
                      }`}
                    >
                      {lang === "tr" ? "Yeni Müşteri" : "New Customer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode("existing")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        customerMode === "existing"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                          : "text-gray-500 hover:text-gray-800 dark:text-slate-400"
                      }`}
                    >
                      {lang === "tr" ? "Kayıtlı Müşteri" : "Existing"}
                    </button>
                  </div>
                </div>

                {customerMode === "new" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder={
                        lang === "tr"
                          ? "Müşteri Adı Soyadı"
                          : "Customer Full Name"
                      }
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder={
                        lang === "tr" ? "Telefon (05XX...)" : "Phone number"
                      }
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <CustomSelect
                    value={selectedCustomerId}
                    onChange={(val) => setSelectedCustomerId(val)}
                    options={customers.map((c) => ({
                      value: c.id,
                      label:
                        c.full_name ||
                        (lang === "tr" ? "İsimsiz Müşteri" : "Customer"),
                      sublabel: c.phone || undefined,
                    }))}
                    placeholder={
                      lang === "tr"
                        ? "Kayıtlı müşteri seçin..."
                        : "Select existing customer..."
                    }
                    searchable={true}
                    searchPlaceholder={
                      lang === "tr" ? "Müşteri ara..." : "Search customer..."
                    }
                  />
                )}
              </div>

              {/* Date and Time Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    {lang === "tr" ? "Tarih" : "Date"}
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    {t("dashboard.time")}
                  </label>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {lang === "tr" ? "Not (İsteğe Bağlı)" : "Note (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder={
                    lang === "tr"
                      ? "Örn: Özel istek, vip müşteri..."
                      : "e.g. VIP client..."
                  }
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t("btn.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {formSubmitting
                    ? lang === "tr"
                      ? "Kaydediliyor..."
                      : "Saving..."
                    : t("btn.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
