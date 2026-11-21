# Mobil arayüz yenilemesi — uygulama kılavuzu

Bu doküman, yenilenen arayüzün kurallarını tanımlar. Önizleme: `/taslak`
(`/taslak` rotası canlı sayfaları etkilemez).

## Kapsam

| Ekran | Mobil | Masaüstü |
| --- | --- | --- |
| Keşfet (`/discover`) | Yeni tasarım | Mevcut görünüm korunur |
| Randevu (`/b/[slug]/randevu`) | Yeni tasarım | Mevcut görünüm korunur |
| Randevularım (`/my-appointments`) | Yeni tasarım | **Yeni tasarım** |
| Profilim (`/profile`) | Yeni tasarım | Mevcut görünüm korunur |
| Dükkan profili (`/b/[slug]`) | Yeni tasarım | Mevcut görünüm korunur |
| İşletme paneli (`/dashboard/*`) | — | Dokunulmaz |

**Masaüstü koruma kuralı:** değiştirilen her sınıfın mobil karşılığı yazılır, eski
değer `lg:` önekiyle eklenir. Örnek:

```
rounded-3xl bg-white shadow-[...] lg:rounded-[28px] lg:bg-white/70 lg:backdrop-blur-3xl
```

`lg` breakpoint'i 1024px'dir. Sadece mobil için yeni bir görünüm istiyorsan
`lg:` sınıflarını silme — masaüstü o sınıflarla eski haline döner.

**Kart → liste satırı dönüşümü:** DOM sırası değiştiği için (kapak görseli
kartın üstündeyken listede solda) CSS sınıfıyla sıralama değiştirilemez. Bu
durumda iki blok yazılır:

```tsx
<Fragment key={item.id}>
  {/* MOBİL */}
  <div className="... lg:hidden">…yeni liste satırı…</div>
  {/* MASAÜSTÜ */}
  <div className="hidden lg:flex ...">…mevcut kart aynen…</div>
</Fragment>
```

Böylece masaüstü kartı birebir korunur, mobilde yeni düzen görünür.

## Renk

- Vurgu: `var(--brand)`, `var(--brand-strong)`, `var(--brand-soft)`,
  `var(--brand-soft-hover)`, `var(--brand-text)`, `var(--brand-border)`,
  `var(--brand-shadow)`. Sabit renk (indigo/blue vb.) **yazılmaz**; marka
  paleti işletmenin seçimine göre değişir.
- Durum renkleri yalnızca durum için: amber (bekleyen, puan), emerald
  (onaylandı, başarılı), rose (iptal, çıkış).
- Metin: `text-slate-900 dark:text-white` (başlık), `text-slate-600
  dark:text-slate-300` (gövde), `text-slate-500 dark:text-slate-400` (meta).

## Tipografi

- Sayfa başlığı: `text-2xl font-black tracking-tight`
- Bölüm başlığı: `text-[15px] font-black tracking-tight` + ipucu satırı
  `text-xs text-slate-500 dark:text-slate-400`
- Kart başlığı: `text-[15px] font-bold`
- Fiyat/sayaç: `font-black tabular-nums`

## Yüzeyler

- Kart (mobil):
  `rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15,23,42,0.04),0_10px_30px_rgb(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_1px_2px_rgb(0,0,0,0.35),0_10px_30px_rgb(0,0,0,0.4)]`
- **Cam efekti (`backdrop-blur`) yalnızca sabit öğelerde** kullanılır: üst bar,
  alt menü, sidebar. İçerik kartlarında kullanılmaz.
- Gölge tek ölçekte ve yumuşak; kart yükselme (hover translate) mobilde yok.

## Butonlar

- Birincil (her ekranda en fazla bir tane):
  `inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-[0_6px_16px_var(--brand-shadow)] transition-all active:scale-[0.98]`
- İkincil:
  `inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200`
- Tehlike: `border border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400`
- Dokunma hedefi en az 44px yüksekliğinde.

## Bölüm navigasyonu (segmented)

- Kapsayıcı: `flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-slate-800`
- Aktif: `bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white`
- Pasif: `text-slate-500 dark:text-slate-400`

## Liste satırı

`flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900`

- Görsel: `h-[72px] w-[72px] rounded-xl object-cover`
- Ad: `text-[15px] font-bold text-slate-900 dark:text-white truncate`
- Meta: `text-xs text-slate-500 dark:text-slate-400 truncate`
- Puan: `inline-flex items-center gap-1 text-xs font-bold` + `Star` ikonu
- Fiyat: `text-xs font-extrabold text-[var(--brand-text)]`
- Eylem: `shrink-0 rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-extrabold text-white`

## Hap (chip)

`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold`

- Aktif: `bg-slate-900 text-white dark:bg-white dark:text-slate-900`
- Pasif: `bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`

## Durum rozeti

`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold`

- Bekliyor: amber, Onaylandı: emerald, Tamamlandı: slate, İptal: rose.

## Kurallar

- Sabit renk kodlama (`indigo-`, `blue-`, `purple-` vb.) yeni ekranlarda
  kullanılmaz; `var(--brand-*)` kullanılır.
- Her ekranda tek bir birincil eylem vardır; ikincil eylemler nötr yüzeydedir.
- Boş durumlar aynı kart dilini kullanır.
- Erişilebilirlik: ikon-only düğmelerde `aria-label` zorunlu.
