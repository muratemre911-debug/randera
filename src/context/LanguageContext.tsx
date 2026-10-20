"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { tr, en } from "@/locales";

type Language = "tr" | "en";
type Dictionary = Record<string, string>;

interface LanguageContextType {
  lang: Language;
  t: (key: string) => string;
  toggleLanguage: () => void;
}

const dictionaries: Record<Language, Dictionary> = { tr, en };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANG_COOKIE = "lang";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * İlk render'ın sunucuyla birebir aynı olması için dil localStorage yerine
 * cookie'den okunur: sunucu da `lang=tr` varsayılanını basar, istemci de
 * cookie'yi görür. localStorage sadece mount sonrası geriye dönük uyum için
 * kullanılır (eski kayıtlar), aksi halde hydration uyuşmazlığı oluşur.
 */
function readLangCookie(): Language {
  if (typeof document === "undefined") return "tr";
  const match = document.cookie.match(/(?:^|;\s*)lang=(tr|en)(?:;|$)/);
  return match ? (match[1] as Language) : "tr";
}

function writeLangCookie(lang: Language) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/**
 * İlk render'da kullanılacak dil.
 *
 * Cookie (sunucunun da gördüğü kaynak) önceliklidir. Eski kurulumlarda dil
 * yalnızca localStorage'da saklanıyordu; o kayıt bir kez cookie'ye taşınır.
 *
 * Not: Sunucu tarafında `document` yok, bu yüzden her zaman "tr" döner.
 * İlk render'ın sunucuyla eşleşmesi `.lang-gate` ile korunur (bkz.
 * globals.css) — kullanıcı Türkçe metin görmeden içerik açılmaz.
 */
function readInitialLang(): Language {
  const cookieLang = readLangCookie();
  if (typeof document === "undefined") return cookieLang;
  try {
    const saved = localStorage.getItem(LANG_COOKIE) as Language | null;
    if (saved === "tr" || saved === "en") return saved;
  } catch {
    // localStorage kapalı olabilir.
  }
  return cookieLang;
}

/**
 * Hydration tamamlandı mı?
 *
 * `useSyncExternalStore` ile "sunucuda false, istemcide true" deseni:
 * effect içinde setState çağırmadan hydration durumu öğrenilir.
 * `.lang-gate` bu değere göre içeriği gizler/tanıtır.
 */
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>(readInitialLang);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    // Eski localStorage kaydını cookie'ye taşı (sunucu da görsün).
    try {
      const saved = localStorage.getItem(LANG_COOKIE) as Language | null;
      if ((saved === "tr" || saved === "en") && saved !== readLangCookie()) {
        writeLangCookie(saved);
      }
    } catch {
      // localStorage kapalı olabilir.
    }
  }, []);

  /**
   * Sekmeler arası dil senkronu.
   *
   * Tema değişimi zaten `storage` olayıyla sekmelere yayılıyordu; dil
   * değişimi ise yalnızca o sekmede kalıyordu. Kullanıcı bir sekmede EN'ye
   * geçtiğinde diğer sekmede TR kalıyordu.
   */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LANG_COOKIE) return;
      const next = event.newValue;
      if (next !== "tr" && next !== "en") return;
      setLang(next);
      writeLangCookie(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang = lang === "tr" ? "en" : "tr";
    setLang(newLang);
    localStorage.setItem(LANG_COOKIE, newLang);
    writeLangCookie(newLang);
  }, [lang]);

  /**
   * Çeviri fonksiyonu `useMemo` ile sabitlenir.
   *
   * Neden: `t` her render'da yeni bir fonksiyon olarak oluşuyordu. `t`'yi
   * bağımlılık olarak alan her efekt bu yüzden HER render'da yeniden
   * koşuyordu (ör. giriş sayfasındaki efekt). Stabil bir kimlik, bu tür
   * gereksiz yeniden çalıştırmaları ortadan kaldırır.
   */
  const t = useCallback(
    (key: string): string => {
      const value = dictionaries[lang][key];
      // Eksik anahtar sessizce ham "nav.xxx" olarak görünmesin: geliştirmede uyar
      if (value === undefined && process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] Eksik çeviri anahtarı (${lang}): ${key}`);
      }
      return value || key;
    },
    [lang],
  );

  // Sağlayıcı değeri de sabitlenir: aksi halde her render'da yeni bir
  // nesne oluşur ve tüketen bileşenler gereksiz yeniden render olur.
  const contextValue = useMemo(
    () => ({ lang, t, toggleLanguage }),
    [lang, t, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      <div
        className={`flex min-h-dvh flex-col ${mounted ? "" : "lang-gate"}`}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
