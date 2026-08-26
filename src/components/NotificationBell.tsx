"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

import { useLanguage } from "@/context/LanguageContext";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { t } = useLanguage();

// (Keeping all effect code)
  useEffect(() => {
    // Service Worker Kaydet ve İzin İste
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        // Otomatik izin isteme (Uygulama açılınca)
        if (Notification.permission === "default") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              subscribeUser(registration);
            }
          });
        } else if (Notification.permission === "granted") {
          subscribeUser(registration);
        }
      });
    }

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const subscribeUser = async (registration: ServiceWorkerRegistration) => {
    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.error("VAPID Key eksik. Lütfen .env.local dosyasını kontrol edin.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription })
      });
    } catch (err) {
      console.error("Push subscription failed", err);
    }
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setNotifications(data);
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
        className="relative rounded-full p-2.5 text-gray-500 transition-all hover:bg-black/5 active:scale-90 dark:text-slate-400 dark:hover:bg-white/10"
      >
        <Bell size={20} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-14 z-50 w-80 rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/90 animate-modal-in">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white flex items-center justify-between">
              {t("notifications.title")}
              {unreadCount > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">{unreadCount} {t("notifications.new")}</span>}
            </h3>
            
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">{t("notifications.empty")}</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`rounded-2xl p-3 transition-colors cursor-pointer ${n.is_read ? "opacity-70 bg-gray-50/50 hover:bg-gray-100" : "bg-indigo-50 hover:bg-indigo-100/80"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${n.is_read ? "text-gray-700" : "text-indigo-900"}`}>{n.title}</p>
                      {!n.is_read && <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />}
                    </div>
                    <p className={`mt-1 text-xs ${n.is_read ? "text-gray-500" : "text-indigo-700/80"} leading-relaxed`}>{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
