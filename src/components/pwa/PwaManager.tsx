"use client";

/**
 * PWA altyapısı.
 *
 * 1. Service worker'ı kaydeder ve yeni sürüm çıktığında kullanıcıya haber verir.
 * 2. `<meta name="theme-color">` etiketini aktif temaya göre günceller; böylece
 *    Android durum çubuğu / iOS üst barı uygulamanın zeminiyle aynı renkte olur.
 * 3. Uygulama ana ekrandan (standalone) açıldıysa `<html>` üzerine
 *    `pwa-standalone` sınıfı ekler — çentik/home-bar boşlukları buna göre verilir.
 *
 * Kurulum daveti (install banner) ayrı bileşende: `InstallBanner`.
 */

import { useEffect, useState } from "react";
import InstallBanner from "./InstallBanner";
import { isStandalone } from "@/lib/pwa";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const THEME_COLORS = { light: "#f8fafc", dark: "#0b0d14" };

/**
 * Aktif temaya göre tarayıcı/çentik renklerini günceller.
 *
 * DİKKAT: `<meta name="theme-color">` etiketlerini SİLİP yeniden EKLEMEK
 * yasak. Bu etiketler `viewport` dışa aktarımıyla React tarafından üretilir;
 * React'in sahip olduğu düğümleri DOM'dan koparmak, sonraki gezinmelerde
 * React'in ebeveyn/çocuk eşlemesini bozar ve
 * "Cannot read properties of null (reading 'removeChild')" hatasıyla
 * istemci tarafı gezinmeyi tamamen durdurur. Bu yüzden yalnızca mevcut
 * etiketlerin nitelikleri yerinde güncellenir.
 */
function syncThemeColor(theme: "light" | "dark") {
  const color = THEME_COLORS[theme];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => {
    // Medya sorgusu kaldırılır: tek ve kesin renk geçerli olsun.
    meta.removeAttribute("media");
    meta.setAttribute("content", color);
  });
}

export default function PwaManager() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(false);
  const [reloading, setReloading] = useState(false);

  // --- Tema rengi ---
  useEffect(() => {
    syncThemeColor(theme);
  }, [theme]);

  // --- Standalone (ana ekrandan açılış) tespiti ---
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "pwa-standalone",
        isStandalone(),
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  // --- Service worker kaydı + güncelleme akışı ---
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;

    const trackUpdates = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // controller varsa bu bir "güncelleme", ilk kurulum değil.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });
    };

    /*
     * Service worker YALNIZCA production'da kaydedilir.
     *
     * Geliştirme sunucusunda (Turbopack dev) chunk dosyalarının adı her
     * derlemede değişir ve içerikleri hash'li DEĞİLDİR. SW bunları
     * `/_next/static/*` kuralıyla cache-first önbelleğe alıyordu: kurulmuş
     * PWA bir sonraki yenilemede eski arayüzü gösteriyor, her derlemede yeni
     * ölü önbellek birikiyordu.
     *
     * Ek sorun: `sw.js` içindeki `isDevHost()` yalnızca localhost / 127.0.0.1'e
     * bakıyordu. LAN IP'si (`http://192.168.x.x:3000`, `NEXT_PUBLIC_APP_URL`)
     * ile açılan PWA bu kontrolü atlatıyor, yani dev chunk'ları cache'liyordu.
     *
     * Bu yüzden karar artık sayfanın bildiği `NODE_ENV`'den veriliyor: Next bu
     * değeri derleme sırasında sabitleyerek istemciye gömer.
     */
    if (process.env.NODE_ENV !== "production") {
      // Dev'de ZATEN kayıtlı bir SW'yi kaldır: yoksa eski SW sayfayı kontrol
      // etmeye devam eder, önbellekleri değiştirilemez ve yeni sürümü
      // görmek imkansızlaşır.
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
        .then(async () => {
          if (!("caches" in window)) return;
          const keys = await window.caches.keys();
          await Promise.all(keys.map((key) => window.caches.delete(key)));
        })
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        trackUpdates(reg);
      })
      .catch((err) => {
        console.warn("[pwa] Service worker kaydedilemedi:", err);
      });

    // Uygulama öne geldiğinde güncelleme var mı diye bak (çok sık değil).
    const checkOnVisible = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", checkOnVisible);

    // Yeni sürüm devreye girdiğinde sayfayı bir kez yenile.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", checkOnVisible);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  // --- Çevrimdışı durumu ---
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    setReloading(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      <InstallBanner />

      {/* Çevrimdışı bildirimi */}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3 transition-all duration-300 ${
          offline ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        }`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
        {offline && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 px-3.5 py-2 text-[13px] font-semibold text-amber-900 shadow-lg backdrop-blur-xl dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <span>{t("pwa.offline_title")}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[12px] font-bold text-amber-900 active:scale-95 dark:text-amber-200"
            >
              {t("pwa.offline_retry")}
            </button>
          </div>
        )}
      </div>

      {/* Yeni sürüm hazır */}
      {waitingWorker && (
        <div
          className="fixed inset-x-0 z-[70] flex justify-center px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-xl dark:border-indigo-500/30 dark:bg-slate-900/95">
            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
              {t("pwa.update_ready")}
            </span>
            <button
              type="button"
              onClick={applyUpdate}
              disabled={reloading}
              className="rounded-xl bg-indigo-600 px-3 py-1 text-[12px] font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
            >
              {t("pwa.update_button")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
