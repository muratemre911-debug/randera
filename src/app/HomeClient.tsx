"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  Camera,
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dumbbell,
  Globe,
  GraduationCap,
  MapPin,
  Mail,
  Moon,
  Palette,
  PawPrint,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Users,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import DynamicLogoLink from "@/components/DynamicLogoLink";

/** Zamanla çalışan işletme tipleri — tanıtım amaçlı sabit liste (DB'ye bağlı değil). */
const SECTORS = [
  { icon: Scissors, key: "barber" },
  { icon: Stethoscope, key: "clinic" },
  { icon: Briefcase, key: "consultant" },
  { icon: GraduationCap, key: "education" },
  { icon: Dumbbell, key: "fitness" },
  { icon: Palette, key: "studio" },
  { icon: Camera, key: "photo" },
  { icon: PawPrint, key: "vet" },
] as const;

const FEATURES = [
  { icon: QrCode, key: "f1" },
  { icon: CalendarCheck, key: "f2" },
  { icon: Clock, key: "f3" },
  { icon: Users, key: "f4" },
  { icon: Bell, key: "f5" },
  { icon: MapPin, key: "f6" },
  { icon: Star, key: "f7" },
  { icon: ChartColumn, key: "f8" },
] as const;

const STEPS = ["s1", "s2", "s3"] as const;

const FAQ = ["q1", "q2", "q3", "q4", "q5"] as const;

const MOCK_DAYS = ["11", "12", "13", "14", "15", "16"];
const MOCK_SLOTS = [
  { time: "09:00", state: "free" },
  { time: "10:30", state: "free" },
  { time: "11:00", state: "busy" },
  { time: "13:30", state: "free" },
  { time: "14:30", state: "picked" },
  { time: "16:00", state: "busy" },
] as const;

const CARD =
  "rounded-[28px] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)]";

const SECTION = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** Sakin, marka renkli mesh zemin (işletme panellerindeki blob diliyle aynı). */
function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="animate-blob absolute -top-[12%] -left-[12%] h-[46vmax] w-[46vmax] rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-600/20" />
      <div
        className="animate-blob-slow absolute -top-[8%] right-[-14%] h-[40vmax] w-[40vmax] rounded-full bg-purple-400/25 blur-3xl dark:bg-purple-700/20"
        style={{ animationDelay: "3s" }}
      />
      <div
        className="animate-blob absolute bottom-[-18%] left-[16%] h-[42vmax] w-[42vmax] rounded-full bg-pink-400/20 blur-3xl dark:bg-fuchsia-700/15"
        style={{ animationDelay: "6s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.16),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.22),transparent_60%)]" />
    </div>
  );
}

export default function HomeClient() {
  const { theme, toggleTheme } = useTheme();
  const { lang, t, toggleLanguage } = useLanguage();

  // Kaydırdıkça bölümleri yumuşak şekilde ortaya çıkar (CSS: .reveal)
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");

    // Ortaya çıkma bitince sınıflar kaldırılır; böylece kartların hover
    // geçişleri (transition-all) kendi süresiyle çalışmaya devam eder.
    const reveal = (el: Element) => {
      el.classList.add("is-visible");
      window.setTimeout(
        () => el.classList.remove("reveal", "is-visible"),
        1000,
      );
    };

    if (!("IntersectionObserver" in window)) {
      targets.forEach(reveal);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    // Gövde overflow:hidden olduğu için landing kendi kaydırma kabını kullanır.
    <div className="custom-scrollbar fixed inset-0 overflow-y-auto overflow-x-hidden scroll-smooth bg-slate-50 dark:bg-[#080A12]">
      <Aurora />

      <div className="relative z-10 flex min-h-full flex-col">
        {/* ---------------------------------------------------------------- Header */}
        <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 rounded-2xl border border-white/60 bg-white/75 px-3 shadow-[0_4px_24px_rgb(15,23,42,0.06)] backdrop-blur-2xl sm:h-16 sm:rounded-[24px] sm:px-5 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_4px_24px_rgb(0,0,0,0.4)]">
            <DynamicLogoLink className="flex items-center gap-2.5">
              <Image
                src="/logo-light.png"
                alt="Randera Logo"
                width={140}
                height={40}
                className="h-7 w-auto object-contain sm:h-8 dark:hidden"
                priority
              />
              <Image
                src="/logo-dark.png"
                alt="Randera Logo"
                width={140}
                height={40}
                className="hidden h-7 w-auto object-contain sm:h-8 dark:block"
                priority
              />
            </DynamicLogoLink>

            <nav className="hidden items-center gap-1 md:flex">
              {[
                { href: "#features", label: t("landing.nav_features") },
                { href: "#how", label: t("landing.nav_how") },
                { href: "#faq", label: t("landing.nav_faq") },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={toggleLanguage}
                aria-label={
                  lang === "tr" ? "Switch to English" : "Türkçeye geç"
                }
                className="flex items-center gap-1.5 rounded-full bg-slate-900/5 px-2.5 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-900/10 active:scale-95 sm:px-3 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              >
                <Globe size={16} />
                {lang.toUpperCase()}
              </button>
              <button
                onClick={toggleTheme}
                aria-label={theme === "light" ? "Dark mode" : "Light mode"}
                className="rounded-full bg-slate-900/5 p-2 text-slate-600 transition-all hover:bg-slate-900/10 active:scale-95 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              >
                {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <Link
                href="/login"
                className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:block dark:text-slate-300 dark:hover:text-white"
              >
                {t("landing.login")}
              </Link>
              <Link
                href="/login?mode=register"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl active:scale-95 sm:px-5"
              >
                {t("landing.start")}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* ------------------------------------------------------------- Hero */}
          <section className="px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
              <div className="reveal">
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3.5 py-1.5 text-xs font-bold tracking-wide text-indigo-600 backdrop-blur-xl sm:text-[13px] dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <Sparkles size={14} />
                  {t("landing.badge")}
                </span>

                <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
                  {t("landing.hero_a")}{" "}
                  <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400">
                    {t("landing.hero_hl")}
                  </span>{" "}
                  {t("landing.hero_b")}
                </h1>

                <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                  {t("landing.hero_sub")}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/login?mode=register"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-base font-bold text-white shadow-xl shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/30 active:scale-95"
                  >
                    {t("landing.hero_cta")}
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                  <Link
                    href="/discover"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-6 py-3.5 text-base font-bold text-slate-700 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white active:scale-95 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    {t("landing.hero_cta2")}
                  </Link>
                </div>

                <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  {t("landing.hero_note")}
                </p>

                <dl className="mt-9 grid max-w-lg grid-cols-3 gap-3 border-t border-slate-900/5 pt-6 dark:border-white/10">
                  {[
                    {
                      value: t("landing.stat1_value"),
                      label: t("landing.stat1_label"),
                    },
                    {
                      value: t("landing.stat2_value"),
                      label: t("landing.stat2_label"),
                    },
                    {
                      value: t("landing.stat3_value"),
                      label: t("landing.stat3_label"),
                    },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <dt className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                        {stat.value}
                      </dt>
                      <dd className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500 sm:text-xs dark:text-slate-400">
                        {stat.label}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Ürün önizlemesi — gerçek ekran görüntüsü yerine saf CSS maket */}
              <div className="reveal relative">
                <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-tr from-indigo-500/25 via-purple-500/15 to-transparent blur-3xl" />

                <div className="relative rounded-[32px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_60px_rgb(15,23,42,0.12)] backdrop-blur-2xl sm:p-5 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_20px_60px_rgb(0,0,0,0.5)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-black text-white shadow-md">
                      RS
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        Randera Studio
                      </p>
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <Star
                          size={12}
                          className="fill-amber-400 text-amber-400"
                        />
                        4.9 · 128
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {t("landing.mock_open")}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.04]">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t("landing.mock_today")}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      {MOCK_DAYS.map((day, i) => (
                        <div
                          key={day}
                          className={`flex h-11 flex-1 flex-col items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                            i === 2
                              ? "bg-gradient-to-b from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                              : "bg-white text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                          }`}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          n === 1
                            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                            : "bg-slate-900/[0.04] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                        }`}
                      >
                        {t(`landing.mock_service${n}`)}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t("landing.mock_slots")}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MOCK_SLOTS.map((slot) => (
                      <div
                        key={slot.time}
                        className={`rounded-xl border py-2 text-center text-xs font-bold ${
                          slot.state === "picked"
                            ? "border-transparent bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                            : slot.state === "busy"
                              ? "border-transparent bg-slate-900/[0.04] text-slate-300 line-through dark:bg-white/[0.04] dark:text-slate-500"
                              : "border-slate-200/80 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        {slot.time}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
                    <CheckCircle2 size={16} />
                    {t("landing.mock_confirm")}
                  </div>
                </div>

                <div className="animate-float absolute -bottom-6 -left-3 hidden max-w-[230px] items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur-2xl sm:flex dark:border-white/10 dark:bg-slate-900/90">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                    <Bell size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {t("landing.mock_new_title")}
                    </p>
                    <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {t("landing.mock_new_sub")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------- Sectors */}
          <section className={`${SECTION} reveal pb-16 sm:pb-24`}>
            <div className="text-center">
              <h2 className="text-balance text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                {t("landing.sectors_title")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                {t("landing.sectors_sub")}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {SECTORS.map((sector) => (
                <span
                  key={sector.key}
                  className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-3.5 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-indigo-400/30 dark:hover:text-indigo-300"
                >
                  <sector.icon
                    size={17}
                    className="text-indigo-500 dark:text-indigo-400"
                  />
                  {t(`landing.sector.${sector.key}`)}
                </span>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------------- Features */}
          <section
            id="features"
            className={`${SECTION} scroll-mt-28 pb-16 sm:pb-24`}
          >
            <div className="reveal text-center">
              <h2 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                {t("landing.features_title")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                {t("landing.features_sub")}
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.key}
                  className={`${CARD} reveal group p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200/80 hover:shadow-[0_18px_40px_rgb(79,70,229,0.12)] dark:hover:border-indigo-400/25`}
                  style={{ transitionDelay: `${(i % 4) * 60}ms` }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 transition-transform duration-300 group-hover:scale-110 dark:from-indigo-500/15 dark:to-purple-500/15 dark:text-indigo-300">
                    <feature.icon size={21} />
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    {t(`landing.${feature.key}_title`)}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {t(`landing.${feature.key}_desc`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------------- How it works */}
          <section
            id="how"
            className={`${SECTION} scroll-mt-28 pb-16 sm:pb-24`}
          >
            <div
              className={`${CARD} reveal relative overflow-hidden p-6 sm:p-10`}
            >
              <div className="text-center">
                <h2 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                  {t("landing.how_title")}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                  {t("landing.how_sub")}
                </p>
              </div>

              <ol className="relative mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
                <div
                  aria-hidden
                  className="absolute top-6 right-[18%] left-[18%] hidden border-t-2 border-dashed border-indigo-200/70 sm:block dark:border-indigo-400/20"
                />
                {STEPS.map((step, i) => (
                  <li
                    key={step}
                    className="relative flex flex-col items-center text-center"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-black text-white shadow-lg shadow-indigo-500/25">
                      {i + 1}
                    </span>
                    <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                      {t(`landing.${step}_title`)}
                    </h3>
                    <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {t(`landing.${step}_desc`)}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ------------------------------------------------------------ Roles */}
          <section className={`${SECTION} pb-16 sm:pb-24`}>
            <div className="reveal text-center">
              <h2 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                {t("landing.roles_title")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                {t("landing.roles_sub")}
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              {[
                {
                  icon: Building2,
                  keyPrefix: "biz",
                  title: t("landing.biz_title"),
                  desc: t("landing.biz_desc"),
                  bullets: ["b1", "b2", "b3", "b4"],
                  cta: t("landing.biz_cta"),
                  href: "/login?mode=register",
                  highlight: true,
                },
                {
                  icon: Users,
                  keyPrefix: "cust",
                  title: t("landing.cust_title"),
                  desc: t("landing.cust_desc"),
                  bullets: ["b1", "b2", "b3", "b4"],
                  cta: t("landing.cust_cta"),
                  href: "/discover",
                  highlight: false,
                },
              ].map((role) => (
                <div
                  key={role.title}
                  className={`${CARD} reveal group flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgb(79,70,229,0.12)] sm:p-8 ${
                    role.highlight
                      ? "border-indigo-200/70 dark:border-indigo-400/20"
                      : ""
                  }`}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 transition-transform duration-300 group-hover:scale-105">
                    <role.icon size={26} />
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {role.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {role.desc}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {role.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-[13px] font-medium leading-relaxed text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle2
                          size={17}
                          className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400"
                        />
                        {t(`landing.${role.keyPrefix}_${bullet}`)}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={role.href}
                    className={`mt-7 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all active:scale-95 ${
                      role.highlight
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500"
                        : "bg-slate-900/5 text-slate-800 hover:bg-slate-900/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                    }`}
                  >
                    {role.cta}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* -------------------------------------------------------------- FAQ */}
          <section
            id="faq"
            className={`${SECTION} scroll-mt-28 pb-16 sm:pb-24`}
          >
            <div className="reveal text-center">
              <h2 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                {t("landing.faq_title")}
              </h2>
              <p className="mt-4 text-sm text-slate-600 sm:text-base dark:text-slate-400">
                {t("landing.faq_sub")}
              </p>
            </div>

            <div className="reveal mx-auto mt-10 max-w-3xl space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item}
                  className={`${CARD} group overflow-hidden px-5 py-4 transition-colors dark:open:border-indigo-400/25`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-bold text-slate-900 sm:text-base dark:text-white [&::-webkit-details-marker]:hidden">
                    {t(`landing.${item}`)}
                    <ChevronDown
                      size={19}
                      className="shrink-0 text-indigo-500 transition-transform duration-300 group-open:rotate-180 dark:text-indigo-400"
                    />
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">
                    {t(`landing.a${item.slice(1)}`)}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------------- CTA band */}
          <section className={`${SECTION} pb-16 sm:pb-24`}>
            <div className="reveal relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-6 py-12 text-center shadow-2xl shadow-indigo-500/25 sm:px-12 sm:py-16">
              <div
                aria-hidden
                className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/20 blur-3xl"
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-fuchsia-300/25 blur-3xl"
              />
              <div className="relative">
                <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {t("landing.band_title")}
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-indigo-50/90 sm:text-base">
                  {t("landing.band_sub")}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/login?mode=register"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-bold text-indigo-700 shadow-xl transition-all hover:-translate-y-0.5 hover:bg-indigo-50 active:scale-95 sm:w-auto"
                  >
                    {t("landing.hero_cta")}
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-6 py-3.5 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10 active:scale-95 sm:w-auto"
                  >
                    {t("landing.login")}
                  </Link>
                </div>
                <p className="mt-5 text-xs font-semibold text-indigo-100/80">
                  {t("landing.band_note")}
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* ------------------------------------------------------------- Footer */}
        <footer className="mt-auto border-t border-slate-900/5 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
          <div className={`${SECTION} py-12`}>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Image
                  src="/logo-light.png"
                  alt="Randera Logo"
                  width={140}
                  height={40}
                  className="h-8 w-auto object-contain dark:hidden"
                />
                <Image
                  src="/logo-dark.png"
                  alt="Randera Logo"
                  width={140}
                  height={40}
                  className="hidden h-8 w-auto object-contain dark:block"
                />
                <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("landing.footer_tagline")}
                </p>
                <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                  <Mail size={15} className="text-indigo-500" />
                  destek@randera.com
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("landing.footer_product")}
                </h3>
                <ul className="mt-3 space-y-0.5 text-[13px] font-semibold">
                  {[
                    { href: "/discover", label: t("landing.footer_discover") },
                    { href: "/login", label: t("landing.login") },
                    {
                      href: "/login?mode=register",
                      label: t("landing.footer_register"),
                    },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="flex min-h-6 items-center text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("landing.footer_legal")}
                </h3>
                <ul className="mt-3 space-y-0.5 text-[13px] font-semibold">
                  {[
                    { href: "/privacy", label: t("landing.footer_privacy") },
                    { href: "/terms", label: t("landing.footer_terms") },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="flex min-h-6 items-center text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-900/5 pt-6 text-xs text-slate-500 sm:flex-row dark:border-white/10 dark:text-slate-400">
              <p>© 2026 Randera. {t("landing.footer_rights")}</p>
              <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0">
                <button
                  onClick={toggleLanguage}
                  className="flex min-h-6 items-center font-semibold transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {lang === "tr" ? "English" : "Türkçe"}
                </button>
                <button
                  onClick={toggleTheme}
                  className="flex min-h-6 items-center font-semibold transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {theme === "light" ? "Dark mode" : "Light mode"}
                </button>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
