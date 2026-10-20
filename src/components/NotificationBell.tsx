"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Notification } from "@/types";

import { useLanguage } from "@/context/LanguageContext";

type PushPermission = "unsupported" | "default" | "granted" | "denied";

/** Sunucuda `Notification` yoktur; bu yüzden ilk değer tembel hesaplanır. */
function readPushPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushPermission;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushPermission>(readPushPermission);
  const { t } = useLanguage();
  const supabase = useMemo(() => createClient(), []);

  // Bildirim izni ve service worker kaydı PwaManager tarafından yapılır;
  // burada yalnızca mevcut durum okunur ve izin KULLANICI TIKLAMASI olmadan
  // istenmez (tarayıcılar sayfa açılışında izin istemeyi engeller ve bu
  // kullanıcı açısından rahatsız edicidir).

  // İşletme kimliği bir kez çözülür; her yoklamada yeniden sorgulanmaz.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      if (!cancelled) setTenantId(profile?.tenant_id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const fetchNotifications = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data as Notification[]);
  }, [supabase, tenantId]);

  // Yoklama yalnızca sekme görünürken çalışır: arka planda pil/veri tüketmez.
  // Service worker ön planda push aldığında liste anında tazelenir.
  useEffect(() => {
    if (!tenantId) return;

    const refresh = () => void fetchNotifications();
    refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPush = () => refresh();

    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [tenantId, fetchNotifications]);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  /** Yalnızca kullanıcı tıkladığında çağrılır (tarayıcı kuralı). */
  const enablePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPushState(permission as "default" | "granted" | "denied");
      if (permission !== "granted") return;

      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
    } catch (err) {
      console.error("Push subscription failed", err);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-full p-2.5 sm:p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
      >
        <Bell size={18} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-14 z-50 w-[min(20rem,calc(100vw-1.75rem))] rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/90 animate-modal-in">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white flex items-center justify-between">
              {t("notifications.title")}
              {unreadCount > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg dark:bg-indigo-500/20 dark:text-indigo-300">{unreadCount} {t("notifications.new")}</span>}
            </h3>

            {/* Bildirim izni yalnızca buradan, kullanıcı tıklamasıyla istenir */}
            {pushState === "default" && (
              <button
                type="button"
                onClick={enablePush}
                className="mb-3 flex w-full items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 text-left transition active:scale-[0.98] dark:border-indigo-500/20 dark:bg-indigo-500/10"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Bell size={15} strokeWidth={2.5} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-indigo-900 dark:text-indigo-200">
                    {t("pwa.notif_title")}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-indigo-700/80 dark:text-indigo-300/80">
                    {t("pwa.notif_desc")}
                  </span>
                </span>
              </button>
            )}
            {pushState === "denied" && (
              <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-[11.5px] font-medium leading-snug text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {t("pwa.notif_denied")}
              </p>
            )}

            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">{t("notifications.empty")}</div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`w-full text-left rounded-2xl p-3 transition-colors cursor-pointer ${
                      n.is_read
                        ? "opacity-70 bg-gray-50/50 hover:bg-gray-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                        : "bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          n.is_read
                            ? "text-gray-700 dark:text-slate-300"
                            : "text-indigo-900 dark:text-indigo-300"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                      )}
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        n.is_read
                          ? "text-gray-500 dark:text-slate-400"
                          : "text-indigo-700/80 dark:text-indigo-300/80"
                      } leading-relaxed`}
                    >
                      {n.message}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
