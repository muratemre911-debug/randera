"use client";

/**
 * Arayüz yenilemesi önizleme rotası (/taslak).
 *
 * Bu sayfa canlı uygulamaya dahil değildir: yalnızca yeni arayüzün örnek
 * ekranlarını göstermek için vardır. Tasarım onaylandıktan sonra aynı
 * bileşenler gerçek sayfalara taşınır.
 */
import { useState } from "react";
import { Monitor, Smartphone, Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  DiscoverMock,
  BusinessMock,
  BookingMock,
  AppointmentsMock,
  ProfileMock,
  DashboardMock,
} from "@/components/prototype/mocks";

const SCREENS = [
  { id: "discover", label: "Keşfet", Component: DiscoverMock },
  { id: "business", label: "İşletme", Component: BusinessMock },
  { id: "booking", label: "Randevu", Component: BookingMock },
  { id: "appointments", label: "Randevularım", Component: AppointmentsMock },
  { id: "profile", label: "Profilim", Component: ProfileMock },
  { id: "dashboard", label: "Panel", Component: DashboardMock },
] as const;

export default function PrototypePreviewPage() {
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState<string>("discover");
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile");

  const current = SCREENS.find((s) => s.id === active) ?? SCREENS[0];
  const Screen = current.Component;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Kontrol çubuğu */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
              <Sparkles size={18} />
            </span>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                Arayüz Yenilemesi · Önizleme
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Onaylamadan önce örnek ekranlar — canlı sayfalar etkilenmez.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {SCREENS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    active === s.id
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewport("mobile")}
                aria-label="Mobil görünüm"
                className={`rounded-lg p-1.5 transition-all ${
                  viewport === "mobile"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                <Smartphone size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewport("desktop")}
                aria-label="Masaüstü görünüm"
                className={`rounded-lg p-1.5 transition-all ${
                  viewport === "desktop"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                <Monitor size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Tema değiştir"
              className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Önizleme alanı */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {viewport === "mobile" ? (
          <div className="mx-auto w-full max-w-[390px]">
            <div className="overflow-hidden rounded-[2.75rem] border-[10px] border-slate-900 bg-slate-900 shadow-[0_30px_80px_rgb(15,23,42,0.35)]">
              <div className="flex h-9 items-center justify-between bg-slate-900 px-6 text-[11px] font-semibold text-white/90">
                <span>09:41</span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-4 rounded-sm bg-white/70" />
                  <span className="h-2 w-2 rounded-full bg-white/70" />
                  <span className="h-2.5 w-4 rounded-sm border border-white/70" />
                </span>
              </div>
              <div className="@container h-[720px] overflow-y-auto overflow-x-hidden bg-white dark:bg-slate-900">
                <Screen />
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Mobil önizleme (390px)
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgb(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 dark:border-slate-800 dark:bg-slate-800/70">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 dark:bg-slate-900">
                  randera.app/{current.id}
                </span>
              </div>
              <div className="@container h-[680px] overflow-y-auto overflow-x-hidden bg-white dark:bg-slate-900">
                <Screen />
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Masaüstü önizleme (1280px)
            </p>
          </div>
        )}

        {/* Onay notları */}
        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
            Bu önizlemede neler değişiyor?
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>• İçerik yüzeyleri net arka plana geçiyor; &ldquo;cam&rdquo; efekti yalnızca üst bar ve alt menü gibi sabit öğelerde kalıyor.</li>
            <li>• Kart, buton ve hap geometrisi tek bir ölçeğe (20/12 px) sabitleniyor.</li>
            <li>• Her ekranda tek bir birincil eylem var; ikincil eylemler nötr yüzeyde.</li>
            <li>• Renk: marka rengi tek vurgu; durum renkleri (amber/emerald/rose) sadece durum için.</li>
            <li>• Tipografi: başlıklar kalın ve sıkı, meta bilgiler küçük ve soluk.</li>
            <li>• Liste satırları tek kart yerine tek satır; fiyat ve eylem aynı hizada.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
