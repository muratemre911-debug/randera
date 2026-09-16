"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { tr } from "@/locales/tr";
import { en } from "@/locales/en";

type Language = "tr" | "en";
type Dictionary = Record<string, string>;

interface LanguageContextType {
  lang: Language;
  t: (key: string) => string;
  toggleLanguage: () => void;
}

const dictionaries: Record<Language, Dictionary> = { tr, en };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>("tr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("lang") as Language | null;
    if (savedLang && (savedLang === "tr" || savedLang === "en")) {
      setLang(savedLang);
    }
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    const newLang = lang === "tr" ? "en" : "tr";
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  };

  const t = (key: string): string => {
    const value = dictionaries[lang][key];
    // Eksik anahtar sessizce ham "nav.xxx" olarak görünmesin: geliştirmede uyar
    if (value === undefined && process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Eksik çeviri anahtarı (${lang}): ${key}`);
    }
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLanguage }}>
      <div style={{ visibility: !mounted ? 'hidden' : 'visible', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
