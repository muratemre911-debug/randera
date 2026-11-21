/**
 * Canlı sayfaları, belirtilen genişlikte (masaüstü) görmek için kullanılan
 * geliştirme yardımcısı: iframe içindeki sayfa kendi genişliğine göre
 * media query uygular, böylece `lg:` sınıfları gerçekten devrede olur.
 *
 * Kullanım: /taslak/canli?sayfa=/discover&genislik=1280
 */
export default async function LivePreview({
  searchParams,
}: {
  searchParams: Promise<{ sayfa?: string; genislik?: string }>;
}) {
  const { sayfa = "/discover", genislik = "1280" } = await searchParams;
  const width = Math.min(Math.max(Number(genislik) || 1280, 320), 1920);

  return (
    <div className="min-h-screen bg-slate-100 p-4 dark:bg-slate-950">
      <p className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {sayfa} — {width}px
      </p>
      <iframe
        src={sayfa}
        title={sayfa}
        className="h-[900px] rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        style={{ width }}
      />
    </div>
  );
}
