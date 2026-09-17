"use client";

/**
 * "Ana ekrana ekle" daveti.
 *
 * - Android / masaüstü Chromium: `beforeinstallprompt` yakalanır ve tek
 *   dokunuşla yerel kurulum diyaloğu açılır.
 * - iOS Safari: yerel bir kurulum API'si yok; kullanıcıya Paylaş → "Ana Ekrana
 *   Ekle" yolunu anlatan kısa bir yönerge gösterilir.
 * - Uygulama zaten standalone çalışıyorsa veya kullanıcı reddettiyse hiç
 *   gösterilmez (14 gün hatırlanır).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, Plus } from "lucide-react";
import { hasBottomNav } from "@/components/layout/shell";
import { isIOS, isStandalone } from "@/lib/pwa";
import { useLanguage } from "@/context/LanguageContext";

const DISMISS_KEY = "randera:pwa-install-dismissed";
const DISMISS_DAYS = 14;
const APPEAR_DELAY = 3000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return true; // localStorage kapalıysa kullanıcıyı rahatsız etme
  }
}

export default function InstallBanner() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;
    if (isStandalone()) return;

    const ua = window.navigator.userAgent;
    // iOS'ta öneri yalnızca Safari'de işe yarar (diğer tarayıcılar ana ekrana ekleyemez).
    const isIOSSafari = isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    const timer = window.setTimeout(() => {
      if (isIOSSafari) {
        setIosHint(true);
        setVisible(true);
      }
    }, APPEAR_DELAY);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setIosHint(false);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      setVisible(false);
      setPromptEvent(null);
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* yok sayılır */
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* yok sayılır */
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setPromptEvent(null);
    }
  };

  if (!visible || (!promptEvent && !iosHint)) return null;

  // Alt navigasyon varsa onun üstünde dur, yoksa güvenli alan kadar yukarıda.
  const bottom = hasBottomNav(pathname)
    ? "calc(env(safe-area-inset-bottom, 0px) + 4.9rem)"
    : "calc(env(safe-area-inset-bottom, 0px) + 1rem)";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 pb-1"
      style={{ bottom }}
    >
      <div className="animate-modal-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-3xl border border-white/60 bg-white/90 p-3 shadow-[0_16px_40px_rgb(15,23,42,0.18)] backdrop-blur-2xl dark:border-slate-700/60 dark:bg-slate-900/90">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-tight text-slate-900 dark:text-slate-100">
            {t("pwa.install_title")}
          </p>
          {iosHint ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              <Share size={12} className="shrink-0" />
              <span>{t("pwa.ios_desc")}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              {t("pwa.install_desc")}
            </p>
          )}
        </div>

        {!iosHint && (
          <button
            type="button"
            onClick={install}
            className="flex shrink-0 items-center gap-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-md shadow-indigo-500/25 transition active:scale-95"
          >
            <Plus size={14} strokeWidth={3} />
            {t("pwa.install_button")}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("pwa.install_later")}
          className="shrink-0 rounded-full px-2 py-1 text-[12px] font-semibold text-slate-400 transition active:scale-90 dark:text-slate-500"
        >
          {t("pwa.install_later")}
        </button>
      </div>
    </div>
  );
}
