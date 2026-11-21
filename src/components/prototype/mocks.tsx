/**
 * Arayüz yenilemesi önizlemesi: ana ekranların mock çizimleri.
 *
 * Yalnızca `/taslak` rotasında kullanılır. Canlı sayfalar bu dosyadan etkilenmez.
 */
import React from "react";
import {
  Search,
  MapPin,
  Star,
  Heart,
  Calendar,
  Clock,
  ChevronRight,
  SlidersHorizontal,
  List,
  Map as MapIcon,
  Scissors,
  Sparkles,
  User,
  LayoutDashboard,
  Bell,
  Settings,
  CreditCard,
  LogOut,
  HelpCircle,
  TrendingUp,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  MockCard,
  MockSectionTitle,
  MockPrimary,
  MockSecondary,
  MockChip,
  MockThumb,
  MockStatus,
  MockBottomNav,
  MockTopBar,
} from "./kit";

const IMG = {
  barber:
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
  cut: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
  cut2:
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
  spa: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
  nail: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
  barbershop:
    "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
};

const NAV = [
  { label: "Keşfet", icon: <Search size={20} strokeWidth={2.2} /> },
  { label: "Favoriler", icon: <Heart size={20} strokeWidth={2.2} /> },
  { label: "Randevular", icon: <Calendar size={20} strokeWidth={2.2} /> },
  { label: "Profil", icon: <User size={20} strokeWidth={2.2} /> },
];

/* ---------------------------------------------------------------- Keşfet */

export function DiscoverMock() {
  const businesses = [
    {
      name: "Yakuşıklu Berber",
      sector: "Berber",
      rating: "4.7",
      reviews: "3",
      distance: "1,2 km",
      price: "₺350",
      img: IMG.barbershop,
    },
    {
      name: "Blade Studio",
      sector: "Kuaför",
      rating: "4.9",
      reviews: "128",
      distance: "2,4 km",
      price: "₺450",
      img: IMG.cut,
    },
    {
      name: "Saha Wellness",
      sector: "Spa & Masaj",
      rating: "4.5",
      reviews: "76",
      distance: "3,1 km",
      price: "₺900",
      img: IMG.spa,
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50 dark:bg-[#0B0D14]">
      <div className="space-y-4 p-4 pb-6">
        <MockTopBar
          title="Keşfet"
          subtitle="Size en uygun işletmeyi bulun, anında randevu alın."
          right={
            <div className="flex shrink-0 items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <span className="rounded-lg bg-white p-1.5 text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white">
                <List size={16} />
              </span>
              <span className="p-1.5 text-slate-400">
                <MapIcon size={16} />
              </span>
            </div>
          }
        />

        {/* Arama + filtre */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgb(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <Search size={17} className="shrink-0 text-slate-400" />
            <span className="truncate text-sm text-slate-400">
              İşletme, konum veya kategori ara...
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-xs font-bold text-slate-700 shadow-[0_1px_2px_rgb(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <SlidersHorizontal size={16} />
            Filtrele
          </span>
        </div>

        {/* Kategori hapları */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <MockChip active>Tümü</MockChip>
          <MockChip icon={<Scissors size={13} />}>Berber</MockChip>
          <MockChip>Kuaför</MockChip>
          <MockChip icon={<Sparkles size={13} />}>Spa</MockChip>
          <MockChip>Diş</MockChip>
          <MockChip>Masaj</MockChip>
        </div>

        {/* Sonuç sayısı + sıralama */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            24 işletme bulundu
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
            Önerilen <ChevronRight size={13} className="rotate-90" />
          </span>
        </div>

        {/* İşletme listesi */}
        <div className="space-y-3">
          {businesses.map((b) => (
            <MockCard key={b.name} className="flex items-center gap-3 p-3">
              <MockThumb src={b.img} className="h-[72px] w-[72px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-[15px] font-bold text-slate-900 dark:text-white">
                    {b.name}
                  </h4>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {b.sector} · {b.distance}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {b.rating}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({b.reviews})
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {b.price}&apos;dan
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-extrabold text-white shadow-[0_4px_12px_var(--brand-shadow)]">
                Randevu
              </span>
            </MockCard>
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <MockBottomNav items={NAV} active={0} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- İşletme */

export function BusinessMock() {
  return (
    <div className="flex min-h-full flex-col bg-slate-50 dark:bg-[#0B0D14]">
      <div className="space-y-4 p-4 pb-6">
        {/* Kapak + avatar */}
        <div className="relative">
          <div className="relative h-40 overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.barbershop} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
            <span className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-rose-500 backdrop-blur-md">
              <Heart size={18} className="fill-rose-500" />
            </span>
          </div>
          <div className="-mt-10 ml-5 h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg dark:border-slate-900 dark:bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.cut2} alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Yakuşıklu Berber
            </h1>
            <MockChip>Berber</MockChip>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              4.7 <span className="font-normal">(3 değerlendirme)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} />
              İstiklal Mah. Demirciler Sokak, Tepebaşı
            </span>
          </div>
        </div>

        {/* Aksiyon satırı */}
        <div className="flex items-stretch gap-2">
          <MockPrimary className="flex-1 py-3">
            <Calendar size={17} strokeWidth={2.4} />
            Randevu Al
          </MockPrimary>
          <span className="flex min-w-0 items-center gap-1.5 rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 text-sm font-extrabold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <Star size={15} className="fill-amber-400 text-amber-400" />
            4.7
            <span className="text-[11px] font-semibold opacity-70">(3)</span>
          </span>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Hizmetler
            <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] dark:bg-slate-700">
              4
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3.5 py-2 text-xs font-bold text-white shadow-[0_4px_12px_var(--brand-shadow)]">
            Paylaşımlar
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
              4
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Değerlendirmeler
            <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] dark:bg-slate-700">
              3
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Konum
          </span>
        </div>

        {/* Paylaşımlar */}
        <MockSectionTitle
          title="İşletme Paylaşımları"
          hint="İşletmenin güncel duyuruları ve çalışmalarından kareler."
        />
        <div className="grid grid-cols-2 gap-2.5">
          {[IMG.cut, IMG.cut2, IMG.spa, IMG.nail].map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className="aspect-square w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <MockBottomNav items={NAV} active={0} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Randevu */

export function BookingMock() {
  const services = [
    { name: "Saç Kesimi", price: "₺350", time: "30 dk", active: true },
    { name: "Sakal Tıraşı", price: "₺200", time: "20 dk", active: false },
    { name: "Saç + Sakal", price: "₺500", time: "45 dk", active: false },
    { name: "Çocuk Saç Kesimi", price: "₺250", time: "25 dk", active: false },
  ];
  const days = [
    { d: "Pzt", n: "23" },
    { d: "Sal", n: "24" },
    { d: "Çar", n: "25" },
    { d: "Per", n: "26" },
    { d: "Cum", n: "27" },
  ];
  const slots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"];

  return (
    <div className="flex min-h-full flex-col bg-slate-50 dark:bg-[#0B0D14]">
      <div className="space-y-5 p-4 pb-6">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <ArrowLeft size={18} />
          </span>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Randevu Al
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yakuşıklu Berber · Adım 1/3
            </p>
          </div>
        </div>

        {/* Hizmet seçimi */}
        <MockSectionTitle title="Hizmet seç" hint="Tek hizmet veya combo seçebilirsiniz" />
        <div className="space-y-2">
          {services.map((s) => (
            <MockCard
              key={s.name}
              className={`flex items-center gap-3 p-3.5 ${
                s.active
                  ? "border-[var(--brand-border)] ring-1 ring-[var(--brand)]"
                  : ""
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  s.active
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {s.active && <Check size={12} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {s.name}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Clock size={11} /> {s.time}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black text-slate-900 dark:text-white">
                {s.price}
              </span>
            </MockCard>
          ))}
        </div>

        {/* Tarih */}
        <MockSectionTitle title="Tarih" hint="Kasım 2026" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d, i) => (
            <span
              key={d.n}
              className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-2.5 ${
                i === 1
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-[0_6px_16px_var(--brand-shadow)]"
                  : "border-slate-200/80 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span className="text-[10px] font-bold uppercase opacity-80">
                {d.d}
              </span>
              <span className="text-base font-black">{d.n}</span>
            </span>
          ))}
        </div>

        {/* Saat */}
        <MockSectionTitle title="Saat" hint="Uygun saatler" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {slots.map((s, i) => (
            <span
              key={s}
              className={`rounded-xl border py-2.5 text-center text-xs font-bold ${
                i === 2
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-slate-200/80 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Sabit alt eylem çubuğu */}
      <div className="sticky bottom-0 border-t border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Toplam
            </p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              ₺350
            </p>
          </div>
          <MockPrimary className="flex-1 py-3">Randevuyu Onayla</MockPrimary>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Randevularım */

export function AppointmentsMock() {
  const items = [
    {
      name: "Yakuşıklu Berber",
      when: "24 Kasım, 15:00",
      service: "Saç + Sakal · 45 dk",
      status: "confirmed" as const,
      statusLabel: "Onaylandı",
      img: IMG.barbershop,
    },
    {
      name: "Saha Wellness",
      when: "28 Kasım, 11:30",
      service: "Klasik Masaj · 60 dk",
      status: "pending" as const,
      statusLabel: "Bekliyor",
      img: IMG.spa,
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50 dark:bg-[#0B0D14]">
      <div className="space-y-4 p-4 pb-6">
        <MockTopBar
          title="Randevularım"
          subtitle="Yaklaşan ve geçmiş randevularınız."
          right={
            <span className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Bell size={18} />
            </span>
          }
        />

        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <span className="flex-1 rounded-lg bg-white py-2 text-center text-xs font-bold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white">
            Yaklaşan
          </span>
          <span className="flex-1 py-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
            Geçmiş
          </span>
        </div>

        <div className="space-y-3">
          {items.map((it) => (
            <MockCard key={it.name} className="p-4">
              <div className="flex items-start gap-3">
                <MockThumb src={it.img} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate text-[15px] font-bold text-slate-900 dark:text-white">
                      {it.name}
                    </h4>
                    <MockStatus label={it.statusLabel} tone={it.status} />
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Calendar size={12} className="text-slate-400" />
                    {it.when}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {it.service}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <MockSecondary className="flex-1 py-2 text-xs">
                  <MapPin size={14} />
                  Yol Tarifi
                </MockSecondary>
                <MockSecondary className="flex-1 py-2 text-xs">
                  <Star size={14} />
                  Değerlendir
                </MockSecondary>
              </div>
            </MockCard>
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <MockBottomNav items={NAV} active={2} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Profil */

const MENU = [
  { label: "Kişisel bilgiler", icon: <User size={18} /> },
  { label: "Randevu tercihleri", icon: <Clock size={18} /> },
  { label: "Ödeme yöntemleri", icon: <CreditCard size={18} /> },
  { label: "Bildirim tercihleri", icon: <Bell size={18} /> },
  { label: "Yardım ve destek", icon: <HelpCircle size={18} /> },
  { label: "Ayarlar", icon: <Settings size={18} /> },
];

export function ProfileMock() {
  return (
    <div className="flex min-h-full flex-col bg-slate-50 dark:bg-[#0B0D14]">
      <div className="space-y-4 p-4 pb-6">
        <MockTopBar title="Profilim" subtitle="Hesabınızı ve randevu tercihlerinizi yönetin." />

        {/* Kimlik kartı */}
        <MockCard className="flex items-center gap-4 p-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xl font-black text-[var(--brand-text)]">
            E
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Emre Yılmaz
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              emre@ornek.com · 0532 000 00 00
            </p>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Düzenle
          </span>
        </MockCard>

        {/* Özet */}
        <MockCard className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
          {[
            { v: "12", l: "Randevu" },
            { v: "3", l: "Favori" },
            { v: "2", l: "Yorum" },
          ].map((s) => (
            <div key={s.l} className="px-2 py-4 text-center">
              <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {s.v}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {s.l}
              </p>
            </div>
          ))}
        </MockCard>

        {/* Menü */}
        <MockCard className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {MENU.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              <span className="text-slate-400">{m.icon}</span>
              <span className="flex-1">{m.label}</span>
              <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
            </div>
          ))}
        </MockCard>

        <div className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
          <LogOut size={16} />
          Çıkış yap
        </div>
      </div>

      <div className="mt-auto">
        <MockBottomNav items={NAV} active={3} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Panel */

export function DashboardMock() {
  const stats = [
    { label: "Bugün", value: "8", icon: <Calendar size={16} /> },
    { label: "Bekleyen", value: "3", icon: <Clock size={16} /> },
    { label: "Bu ay ciro", value: "₺42.8B", icon: <TrendingUp size={16} /> },
  ];
  const rows = [
    { time: "09:00", name: "Ahmet Y.", service: "Saç Kesimi", tone: "confirmed" as const, label: "Onaylandı" },
    { time: "10:30", name: "Selin K.", service: "Saç + Sakal", tone: "pending" as const, label: "Bekliyor" },
    { time: "12:00", name: "Murat D.", service: "Sakal Tıraşı", tone: "confirmed" as const, label: "Onaylandı" },
    { time: "13:30", name: "Zeynep A.", service: "Çocuk Saç Kesimi", tone: "pending" as const, label: "Bekliyor" },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50 dark:bg-[#0B0D14]">
      <div className="space-y-4 p-4 pb-6">
        <MockTopBar
          title="Yakuşıklu Berber"
          subtitle="22 Kasım Pazar · Panel özeti"
          right={
            <span className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <LayoutDashboard size={18} />
            </span>
          }
        />

        {/* İstatistikler */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <MockCard key={s.label} className="p-3.5">
              <span className="inline-flex rounded-lg bg-[var(--brand-soft)] p-1.5 text-[var(--brand-text)]">
                {s.icon}
              </span>
              <p className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {s.value}
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {s.label}
              </p>
            </MockCard>
          ))}
        </div>

        {/* Hızlı işlemler */}
        <MockSectionTitle title="Hızlı işlemler" />
        <div className="grid grid-cols-4 gap-2">
          {["Takvim", "Müşteriler", "İçerik", "Ayarlar"].map((l) => (
            <MockCard key={l} className="flex flex-col items-center gap-1.5 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Scissors size={16} />
              </span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {l}
              </span>
            </MockCard>
          ))}
        </div>

        {/* Bugünün randevuları */}
        <MockSectionTitle
          title="Bugünün randevuları"
          hint="4 randevu"
          action={
            <span className="text-xs font-bold text-[var(--brand-text)]">Tümü</span>
          }
        />
        <MockCard className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.time} className="flex items-center gap-3 px-4 py-3">
              <span className="w-12 shrink-0 font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                {r.time}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {r.name}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {r.service}
                </p>
              </div>
              <MockStatus label={r.label} tone={r.tone} />
            </div>
          ))}
        </MockCard>
      </div>

      <div className="mt-auto">
        <MockBottomNav
          items={[
            { label: "Özet", icon: <LayoutDashboard size={20} strokeWidth={2.2} /> },
            { label: "Takvim", icon: <Calendar size={20} strokeWidth={2.2} /> },
            { label: "Müşteriler", icon: <User size={20} strokeWidth={2.2} /> },
            { label: "Profil", icon: <User size={20} strokeWidth={2.2} /> },
          ]}
          active={0}
        />
      </div>
    </div>
  );
}
