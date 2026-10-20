/**
 * Marka logosu (tema duyarlı, önceden optimize edilmiş).
 *
 * NEDEN ÖNCEDEN OPTİMİZE EDİLMİŞ DOSYALAR
 * ---------------------------------------
 * `public/logo-light.png` (3,3 MB) ve `public/logo-dark.png` (4,7 MB)
 * 2048×2048 px. Uygulamada logonun gösterildiği en büyük alan 56 px
 * (giriş sayfasındaki `h-14 w-14`); kabuk header'ında ise 32 px (`h-8 w-8`).
 * Yani telefon, 32 px'lik bir alan için 2048 px'lik PNG indiriyordu —
 * `/discover` sayfasının 13,4 MB'lik yükünün 7,8 MB'ı yalnız bu iki dosyaydı.
 *
 * `public/logo/*-160.png` bu gösterim boyutlarının tamamını ~3x DPR ile
 * karşılayacak kadar büyük (160 px) ve 8–11 KB. `next/image` kullanılmıyor:
 * logo zaten küçük olduğu için çalışma zamanı optimizasyonu gereksiz
 * (bkz. next/docs "unoptimized": small images / SVG gibi durumlar).
 *
 * NEDEN İKİ VARIANT (`dark:hidden` / `dark:block`) KORUNUYOR
 * --------------------------------------------------------
 * Tema `localStorage`'dan okunur (`ThemeContext`), sunucuda bilinmez. Tek bir
 * `<img>` kullanıp kaynağı temaya göre seçmek hydration uyuşmazlığı üretir.
 * İki varyant + CSS ile seçim tamamen tarayıcıda olur; `loading="lazy"`
 * sayesinde yalnızca görünen olan indirilir (Next 16 image dokümanı,
 * "Theme detection" bölümü aynı deseni önerir).
 */

interface BrandLogoProps {
  /** `<img>` üzerine uygulanacak sınıflar (ör. `h-full w-full object-cover`). */
  className?: string;
  /**
   * Ekran okuyucu açıklaması. Logonun yanında marka adı yazıyorsa boş
   * bırakılabilir (`alt=""`): görsel sadece dekoratiftir, metin zaten okunur.
   */
  alt?: string;
}

/** En büyük gösterim 56 px; 160 px ≈ 2,8x DPR — retina ekranlarda da net. */
const LOGO_SIZE = 160;

const LIGHT_SRC = "/logo/logo-light-160.png";
const DARK_SRC = "/logo/logo-dark-160.png";

export default function BrandLogo({
  className,
  alt = "Randera Logo",
}: BrandLogoProps) {
  const classes = className ?? "";

  return (
    <>
      <img
        src={LIGHT_SRC}
        alt={alt}
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        loading="lazy"
        decoding="async"
        className={`${classes} dark:hidden`}
      />
      <img
        src={DARK_SRC}
        alt={alt}
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        loading="lazy"
        decoding="async"
        className={`hidden ${classes} dark:block`}
      />
    </>
  );
}
